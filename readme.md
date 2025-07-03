# Todo

Unbarrel - create a config file

## hash calculation

in memory, from temp file, from client

user defined hashing method

# Optimistic uploads

SFS supports clientside oprimistic uploads.

You can generate `id` clientside, send it with your request and poll for the file. If upload request fails, stop polling.
