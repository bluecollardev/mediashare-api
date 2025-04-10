# Mediashare API Platform

## Important notes! Read this first!
- There are two repositories for this project.
  - [update-link] - The phone app.
  - [update-link] - This project - the API that backs the phone app.
- This project contains multiple applications - most importantly, the `user-svc`, `media-svc`, `tags-svc` in the `./apps` directory. 
  We use a Monorepo to manage various tasks related to generating boilerplate for, building, and maintaining these applications called NX monorepo [https://nx.dev].
  All applications are Nest.js [https://nestjs.com] applications, located in the `./apps` directory.
- Our applications use Node. It is advisable to run Node using something like nvm to allow you to easily install/switch node versions for various projects.
- Our applications currently uses Node 16 [node:16-alpine]. This can easily be upgraded. When updating this, make sure to update both the `./Dockerfile` and the `./docker/dockerfiles/base.dockerfile` (etc.) files!
- When running the project using Docker locally, be sure to build the base image first - you can do this by running `npm run docker:base`! 
  This is mostly a dev, thing to save time when building / running the app locally.
  By building a base image containing all the Node dependencies first, we only have to rebuild the code for the application when rebuilding the application in Docker. 
- Run `npm run docker:base` whenever you change the Node version in the project!
- We mostly use npm scripts to do various household tasks across the project. Please familiarize yourself with the `scripts` section of `./package.json`.
- We use Gitlab pipelines for CI/CD. To modify the pipeline configuration, please see `./gitlab-ci.yml`. More info and further documentation coming soon.
- We use Jest for unit testing. Each application has its own set of tests, also located in the `./apps` directory, prefixed like: `./apps-<project>-e2e`. 
  If you're using an IntelliJ IDE, the test configurations are located in the `.run` folder in the root directory of this project.

## Running the app using docker 

If you haven't run the app before, you'll probably want to start here.

1. Install mkcert using `brew install mkcert`.
2. Run `npm run gen:certs` to generate SSH self signed certs for local use. You will need to have previously installed *mkcert* for this to work.
3. Run `npm run docker:base` to build the base image.
4. Run `npm run docker` to build application in docker. These npm scripts handle the launch (see package.json):
- `docker:user-svc:development` starts the user service.
- `docker:media-svc:development` starts the media service.
- `docker:taqs-svc:development` starts the tags service.

## Running the app locally
1. Install mkcert using `brew install mkcert`.
2. Run `npm run gen:certs` to generate SSH self signed certs for local use. You will need to have previously installed *mkcert* for this to work.
3. Run `npm install`.
4. Start the services:
- Run `npm run user-svc:serve` to start the user service.
- Run `npm run media-svc:serve` to start the media service.
- Run `npm run tags-svc:serve` to start the tags service.

## API URLs

### Production
https://user-api.afehrpt.com/api
https://media-api.afehrpt.com/api
https://tags-api.afehrpt.com/api

### Dev
https://user-api.dev.afehrpt.com/api
https://media-api.dev.afehrpt.com/api
https://tags-api.dev.afehrpt.com/api
