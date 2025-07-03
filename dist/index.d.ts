/// <reference types="node" />
import { sfsFileType } from "sfs-file-type";
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
    size: number;
    type: sfsFileType;
    last_modified: number;
    path: string;
    url?: string;
    [key: string]: any;
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
    cleanupOnFailedUpload?: boolean;
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
export default function initFunctions({ publicFolder, mask, getFileById, getFileByHash, createFile, logger, uid, allowDuplicates, cleanupOnFailedUpload, }: sfsConfig): {
    resolveFilePath: (id: sfsFileId) => Promise<{
        filePath: string;
        fileName: string;
    }>;
    idToUrl: (id: sfsFileId) => string;
    urlToId: (url: string) => string;
    saveFile: (file: UploadedFile, options?: {
        filePath?: string;
        id?: sfsFileId;
        additionalFields?: any;
    }) => Promise<sfsFile>;
    deleteFileByHash: (hash: string) => Promise<void>;
    deleteFileById: (id: string) => Promise<void>;
    getDiskUsage: (req: any, res: any) => Promise<import("check-disk-space").DiskSpace>;
};
