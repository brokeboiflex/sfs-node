import fs from "fs";
import path from "path";
import checkDiskSpace from "check-disk-space";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { dotExtensionToCategotry, sfsFileType } from "sfs-file-type";
import { fileTypeFromBuffer } from "file-type";

export interface UploadedFile {
  /** file name */
  name: string;
  /** A function to move the file elsewhere on your server */
  mv(path: string, callback: (err: any) => void): void;
  mv(path: string): Promise<void>;
  /** Encoding type of the file */
  encoding: string;
  /** The mimetype of your file */
  mimetype: string;
  /** A buffer representation of your file, returns empty buffer in case useTempFiles option was set to true. */
  data: Buffer;
  /** Uploaded size in bytes */
  size: number;
  /** MD5 checksum of the uploaded file */
  md5: string;
}
export type sfsFileId = string | number;
export type sfsFile = {
  id: sfsFileId;
  name: string;
  extension: string;
  hash: string;
  size: number; //Bytes
  type: sfsFileType;
  last_modified: number; //timestamp,
  path: string;
  url?: string;
  [key: string]: any; // Allow additional dynamic properties
};
export type loggerLvl = "info" | "success" | "error";
/**
 * Configuration for Simple File Storage (SFS)
 */
export type sfsConfig = {
  /**
   * Folder where files will be stored.
   */
  publicFolder: string;

  /**
   * Base URL prefix to which the file ID will be appended.
   */
  mask: string;

  /**
   * Function that returns an `sfsFile` based on its ID.
   * @param id - The file's unique identifier.
   * @returns A promise resolving to the corresponding `sfsFile`.
   */
  getFileById: (id: sfsFileId) => Promise<sfsFile>;

  /**
   * Function that returns an `sfsFile` based on its content hash.
   * @param hash - The hash of the file contents.
   * @returns A promise resolving to the corresponding `sfsFile`.
   */
  getFileByHash: (hash: string) => Promise<sfsFile>;

  /**
   * Function that stores an `sfsFile` and returns the stored object.
   * @param file - The `sfsFile` to be created.
   * @returns A promise resolving to the stored `sfsFile`.
   */
  createFile: (file: sfsFile) => Promise<sfsFile>;

  /**
   * Optional logger function. Leave undefined to disable logging.
   * @param message - Log message or object.
   * @param lvl - Optional log level (e.g., info, warn, error).
   */
  logger?: (message: any, lvl?: loggerLvl) => void;

  /**
   * Optional function for generating unique IDs.
   * Defaults to `uuidv4()` if not provided.
   * @returns A unique string or number.
   */
  uid?: () => string | number;

  allowDuplicates?: boolean;
};

/**
 * Initializes core logic functions for the Simple File Storage (SFS) system.
 *
 * @param config - The configuration object for the SFS system.
 * @param config.publicFolder - Path to the folder where uploaded files will be stored.
 * @param config.mask - Base URL prefix for constructing public file URLs (e.g., "https://example.com/files").
 * @param config.getFileById - Async function that retrieves an `sfsFile` by its unique ID.
 * @param config.getFileByHash - Async function that retrieves an `sfsFile` by its content hash.
 * @param config.createFile - Async function that stores an `sfsFile` and returns the stored object.
 * @param config.logger - Optional logger function for internal operations. No logging if undefined.
 * @param config.uid - Optional function for generating unique IDs (defaults to `uuidv4` if not provided).
 * @param config.allowDuplicates - Flag deterining whether to allow storing duplicate files in database, important for clientside optimistic uploads
 *
 * @returns An object containing internal logic functions used by the SFS system.
 */

//TODO  Turn it into a class
export default function initFunctions({
  publicFolder,
  mask,
  getFileById,
  getFileByHash,
  createFile,
  logger = undefined,
  uid = uuidv4,
  allowDuplicates = false,
}: sfsConfig) {
  /**
   * Converts a URL to its corresponding file ID by removing the mask prefix.
   * Handles cases where the mask may or may not end with a slash.
   *
   * @param url - The URL string to convert.
   * @returns The extracted file ID from the URL.
   */
  const urlToId = (url: string) =>
    mask.endsWith("/") ? url.replace(mask, "") : url.replace(mask + "/", "");

  /**
   * Converts a file ID to its corresponding URL by prepending the mask prefix.
   * Handles cases where the mask may or may not end with a slash.
   *
   * @param id - The file ID to convert to a URL.
   * @returns The constructed URL string for the given file ID.
   */
  const idToUrl = (id: sfsFileId) =>
    (mask.endsWith("/") ? mask : mask + "/") + id;

  /**
   * Resolves the absolute file system path and original name of a stored file by its ID.
   *
   * This function retrieves metadata for the given file ID using `getFileById`,
   * and constructs the full path to the file in the `publicFolder`, based on its hash and extension.
   *
   * @param id - The unique identifier of the stored file.
   * @returns An object containing the full file system path (`filePath`) and original file name (`fileName`),
   *          or `undefined` if the file was not found.
   */
  const resolveFilePath = async (id: sfsFileId) => {
    try {
      const fileInfo = await getFileById(id);
      const { hash, extension, name } = fileInfo;
      const filePath = hash + extension;
      return { filePath: path.join(publicFolder, filePath), fileName: name };
    } catch (err) {
      logger && logger(err, "error");
    }
  };

  /**
   * Handles upload and deduplication logic for a single file.
   *
   * - Calculates SHA-256 hash of the file content in-memory.
   * - Determines file extension from name or infers from binary data.
   * - Avoids storing duplicates by using `hash + extension` as unique filename.
   * - Saves file to disk if not already stored.
   * - Registers file metadata via `createFile`, or reuses existing entry.
   *
   * @param file - Uploaded file object (e.g., from express-fileupload).
   * @param options - Optional configuration object.
   * @param options.filePath - Logical file path (or folder-relative path) for storing metadata. Defaults to "/".
   * @param options.id - Custom file ID. If not provided, a unique ID will be generated using `uid()`.
   * @param options.additionalData - Additional metadata to store with the file.
   * @returns An `sfsFile` object with generated ID and public URL.
   *
   * @throws Will throw if file saving or metadata operations fail.
   */

  // TODO | ALL properties other than file shouls be optional
  // TODO | Reimplement temp folder for hash calculation
  // TODO | Support user defined hashing methods

  const saveFile = async (
    file: UploadedFile,
    options?: {
      filePath?: string;
      id?: sfsFileId;
      additionalData?: any;
    }
  ) => {
    try {
      // Set default values
      const filePath = options?.filePath || "/";
      const id = options?.id || uid();

      // Save file
      const name = decodeURI(file.name);
      const hash = createHash("sha256").update(file.data).digest("hex");
      // Get extenison
      let extension = "";
      const extensionFromName = path.extname(name);
      if (extensionFromName) {
        extension = extensionFromName;
      } else {
        const filetype = await fileTypeFromBuffer(file.data);
        if (filetype) {
          extension = `.${filetype.ext}`;
        }
      }
      // Filename is its hash + extension to avoid storing duplicate files with different names
      const constPath = path.join(publicFolder, hash + extension);
      let fileInfo = await getFileByHash(hash);

      // File exists
      if (fileInfo) {
        logger && logger("SFS: File already uploaded", "info");
      }
      // File is new
      else {
        logger && logger("SFS: Saving file", "success");
        await file.mv(constPath);
      }
      // File is new or doesnt exist in this folder or duplocates are allowed
      if (!!!fileInfo || filePath !== fileInfo.path || allowDuplicates) {
        const size = fileInfo?.size || fs.statSync(constPath).size;
        const type = fileInfo?.type || dotExtensionToCategotry(extension);
        const now = Date.now();
        const fileData = {
          id,
          name,
          extension,
          hash,
          size,
          type,
          last_modified: now,
          path: filePath,
          publishedAt: now,
          ...options?.additionalData,
        };

        try {
          const mutationResult = await createFile(fileData);
          mutationResult.url = idToUrl(mutationResult.id);
          return mutationResult;
        } catch (createError) {
          // Cleanup: Remove the physical file if database operation failed
          if (!fileInfo && fs.existsSync(constPath)) {
            fs.unlinkSync(constPath);
            logger &&
              logger(
                "SFS: Cleaning up orphaned file after database error",
                "info"
              );
          }
        }
      }

      // File exists in this folder
      else {
        logger && logger("File already exists at this location", "error");
        fileInfo.url = idToUrl(fileInfo.id);

        return fileInfo;
      }
    } catch (err) {
      logger && logger("Upload error", "error");
      throw new Error(err);
    }
  };
  const deleteFileByHash = async (hash: string) => {
    try {
      const files = fs.readdirSync(publicFolder);
      const fileToDelete = files.find((f) => f.split(".")[0] === hash);
      if (!fileToDelete) {
        throw new Error(`File with hash ${hash} not found in ${publicFolder}`);
      }
      const pathToFile = path.join(publicFolder, fileToDelete);
      fs.unlinkSync(pathToFile);
    } catch (err) {
      throw new Error(err);
    }
  };
  const deleteFileById = async (id: string) => {
    try {
      const result = await resolveFilePath(id);
      if (!result) {
        throw new Error(`File with id ${id} not found`);
      }
      const { filePath } = result;
      fs.unlinkSync(filePath);
    } catch (err) {
      throw new Error(err);
    }
  };
  const getDiskUsage = async (req, res) => {
    const diskSpace = await checkDiskSpace(publicFolder);
    return diskSpace;
  };
  return {
    resolveFilePath,
    idToUrl,
    urlToId,
    saveFile,
    deleteFileByHash,
    deleteFileById,
    getDiskUsage,
  };
}
