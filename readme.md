Todo:
remove dependencies

Backblaze integration

# Optimistic uploads

SFS supports clientside oprimistic uploads. You can implement it

You can generate `id` clientside, send it with your request and poll for the file. If upload request fails, stop polling.
