### Binary Import and Export Tools

Replace PASSWORD with the password for the admin user and DATABASE with the name of the database you wish to import/export to your cluster.

Mediashare `mongodump --uri mongodb+srv://<USER>:<PASSWORD>@cluster0.8x36b.mongodb.net/<DATABASE>`
PocketPhysio `mongodump --uri mongodb+srv://<USER>>:<PASSWORD>@cluster0.nureuqr.mongodb.net/<DATABASE>`

TODO: Make a quick CLI tool for this...
`mongodump -d mediashare --gzip --archive=mediashare-backup.20230125-1907.tar.gz`
`mongorestore --gzip --archive=mediashare-backup.20230125-1907.tar.gz --drop --uri mongodb+srv://<USER>:<PASSWORD>@cluster0.8x36b.mongodb.net`
`mongorestore --gzip --archive=mediashare-backup.20230125-1907.tar.gz --drop --uri mongodb+srv://<USER>:<PASSWORD>@cluster0.nureuqr.mongodb.net`
`mongorestore --gzip --archive=mediashare-backup.20231230-153439.with-demo-users.tar.gz --drop`
