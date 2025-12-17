# Simple File Storage (SFS) for Node.js

Simple File Storage (SFS) is a lightweight utility for handling file uploads and metadata persistence in Node.js applications. It focuses on deduplication via hashing, consistent URL generation, and configurable storage backends.

## Features
- 🔒 **Hash-based deduplication**: Files are stored as `<hash><extension>` to avoid duplicates.
- 🧭 **Consistent URLs**: Convert between file IDs and URLs with a configurable `mask` prefix.
- 🧩 **Pluggable storage**: Provide your own functions to fetch and persist file metadata.
- 🧹 **Cleanup support**: Optionally remove orphaned files when metadata writes fail.
- 📦 **CommonJS and ESM builds**: Distributed via `microbundle` with bundled types.

## Installation

```bash
npm install sfs-node
# or
yarn add sfs-node
```

## Quick start

Below is a minimal example using `express-fileupload` (or any middleware that provides a compatible `UploadedFile`).

```ts
import express from "express";
import fileUpload from "express-fileupload";
import sfs from "sfs-node";

const app = express();
app.use(fileUpload());

// Example in-memory store — replace with your DB layer.
const files = new Map();

const sfsCore = sfs({
  publicFolder: "./uploads",
  mask: "https://cdn.example.com/files",
  getFileById: async (id) => files.get(id),
  getFileByHash: async (hash) => [...files.values()].find((f) => f.hash === hash),
  createFile: async (file) => {
    files.set(file.id, file);
    return file;
  },
  logger: console.log,
});

app.post("/upload", async (req, res) => {
  const uploaded = req.files?.file; // name="file" field
  if (!uploaded || Array.isArray(uploaded)) return res.sendStatus(400);

  const result = await sfsCore.saveFile(uploaded, { filePath: "/" });
  res.json(result);
});
```

## Configuration

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `publicFolder` | `string` | ✅ | Absolute/relative folder path where binary files are stored. |
| `mask` | `string` | ✅ | Base URL prefix used to build public URLs for stored files. |
| `getFileById(id)` | `(id: sfsFileId) => Promise<sfsFile>` | ✅ | Retrieve file metadata by unique ID. |
| `getFileByHash(hash)` | `(hash: string) => Promise<sfsFile>` | ✅ | Retrieve metadata by SHA-256 hash (used for deduplication). |
| `createFile(file)` | `(file: sfsFile) => Promise<sfsFile>` | ✅ | Persist file metadata and return the stored record. |
| `logger(message, lvl?)` | `(message: any, lvl?: "info" | "success" | "error") => void` | ❌ | Optional logger used throughout the helpers. |
| `uid()` | `() => string | number` | ❌ | Custom ID generator. Defaults to `uuidv4`. |
| `allowDuplicates` | `boolean` | ❌ | Allow storing multiple metadata entries for the same file. |
| `cleanupOnFailedUpload` | `boolean` | ❌ | If `true`, physical file is removed when metadata persistence fails. |

See `src/index.ts` for the full typings and behaviors.

## Core helpers

The factory `initFunctions(config)` returns:

- `saveFile(file, options?)`: Stores the file on disk (if new) and persists metadata. Adds a `url` property using `idToUrl`.
- `resolveFilePath(id)`: Returns `{ filePath, fileName }` for a given file ID.
- `idToUrl(id)` / `urlToId(url)`: Convert between IDs and masked URLs.
- `deleteFileByHash(hash)` / `deleteFileById(id)`: Remove stored files.
- `getDiskUsage()`: Returns disk usage stats for `publicFolder` via `check-disk-space`.

### `saveFile` options
- `filePath`: Logical path/folder string for metadata (`"/"` by default).
- `id`: Override the generated ID.
- `additionalFields`: Extra metadata merged into the stored object.

### File typing
`UploadedFile` aligns with the structure emitted by `express-fileupload`, including `name`, `mimetype`, `encoding`, `data`, and an `mv()` helper used to move files into `publicFolder`.

## Build scripts

- `npm run build` / `yarn build`: Bundles CommonJS, ESM, and UMD outputs with type declarations via `microbundle`.
- `npm run dev` / `yarn dev`: Watch mode for local development.

## Notes on optimistic uploads

SFS supports client-side optimistic uploads: clients may generate IDs up front, attach them to the upload request, and poll using that ID. When `allowDuplicates` is `false` (default), files are de-duplicated by hash, so repeated uploads of identical content reuse the same stored binary while permitting distinct metadata entries only when `allowDuplicates` is `true`.

## License

ISC
