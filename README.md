# AngularBuildOnceDeployMultiple

This repository is a demonstration of how on aspect ([Build, Release and Run](https://12factor.net/build-release-run)) of the [12 Factor App](https://12factor.net/) can be realized with Angular and Docker.

This guideline gives you an example of how you can build an Angular Application just once for different environments.

In most cases environment.ts  files are used to store and load also environment-specific information (Compile-time Configuration). This approach is fine if you can build for each environment a new application (or even container). But if you like to follow 12 Factor App methodology follow this guide to use Runtime-Configuration to externalize the environment-specific configurations.

## Build Multiple Container for every Environment - Compile-Time Configuration
If we talk about Compile-Time Configuration it means that the configuration is compiled with the code at the time it will be built and bundled. In Angular CLI this is handled within environments the folder. There you can find:
```typescript
// environment.ts
export const environment = {
  production: false
};
```
and 
```typescript
// environment.prod.ts
export const environment = {
  production: true
};
```
If you now look within main.ts you can see that it is used to apply some runtime optimizations if in production mode

```typescript
// main.ts
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
```
Or you can import the environment where ever you need it and use it:
```typescript
import { environment } from '../environment/environment';
...
console.log(environment.production);
```
For different environments, you can create new files called e.g. environment.uat.ts . To finalize you just need to add it to angular.json
```json
// angular.json
{
  // ...
  "projects": {
    "angular-build-once-deploy-multiple": {
      //...
      "architect": {
        "build": {
          // ...
          "configurations": {
            "uat": {
              "fileReplacements": [
                {
                  "replace": "src/environments/environment.ts",
                  "with": "src/environments/environment.uat.ts"
                }
              ],
              //...
            },
            "production": {
              "fileReplacements": [
                {
                  "replace": "src/environments/environment.ts",
                  "with": "src/environments/environment.prod.ts"
                }
              ],
              //...
            }
          }
        },
        //...
      }
    }
  }
}
```
And tell Angular within package.json  for which environment you are building:
```json
// package.json

{
  ...
  "scripts": {
    "ng": "ng",
    "build": "ng build --prod",
    "build:uat": "ng build --configuration uat",
    "build:prod": "ng build --prod",
    ...
  }
```
#### Dockerize for Different Environemt
To create a container for each environment you would need to run either npm run build:uat  or npm run build --prod .

##### UAT Dockerfile
Therefore building for UAT would look like:

```dockerfile
#dockerfile.multibuild.uat
FROM node:latest as node

WORKDIR /app

COPY src ./src
COPY angular.json .
COPY package.json .
COPY package-lock.json .
COPY tsconfig.app.json .
COPY tsconfig.json .
COPY tsconfig.spec.json .

RUN npm install
RUN npm run build:uat

FROM nginx:alpine
COPY --from=node /app/dist/angular-build-once-deploy-multiple /usr/share/nginx/html/
```

##### PRD Dockerfile
Build an image for production would look like:

```dockerfile
#dockerfile.multibuild.prd
FROM node:latest as node

WORKDIR /app

COPY src ./src
COPY angular.json .
COPY package.json .
COPY package-lock.json .
COPY tsconfig.app.json .
COPY tsconfig.json .
COPY tsconfig.spec.json .

RUN npm install
RUN npm run build --prod

FROM nginx:alpine
COPY --from=node /app/dist/angular-build-once-deploy-multiple /usr/share/nginx/html/
```
## Build Once for every Environment - Runtime Configuration
On the other hand with Runtime-Configuration you will be able to change the configuration after deployment as the configuration is collected, as it says, during runtime.

The idea is to store the configuration within a simple JSON file called appConfig.json which you can deploy with your app. When the app runs we will execute an HTTP Request to that JSON file and read the configurations.

As we want to start the app only after the configurations are loaded and applied we will use APP_INITIALIZER token. First we will provide a Service that will fetch the configuration from assets/data/appConfig.json :

```typescript
//app-config.service.ts
app-config.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class AppConfigService {
private appConfig;

constructor(private http: HttpClient) { }

loadAppConfig() {
return this.http.get('/assets/data/appConfig.json')
.toPromise()
.then(data => {
this.appConfig = data;
});
}

getConfig() {
return this.appConfig;
}
}
```
Import the created service within the app.module.ts and implement the factory function as seen below:
```typescript
//app.module.ts
app.module.ts
import { NgModule, APP_INITIALIZER } from '@angular/core';
import { HttpClientModule } from "@angular/common/http";
import { BrowserModule } from '@angular/platform-browser';

import { AppConfigService } from "./services/app-config.service";
import { AppComponent } from './app.component';

const appInitializerFn = (appConfig: AppConfigService) => {
return () => {
return appConfig.loadAppConfig();
};
};

@NgModule({
declarations: [
AppComponent
],
imports: [
BrowserModule,
HttpClientModule
],
providers: [
AppConfigService,
{
provide: APP_INITIALIZER,
useFactory: appInitializerFn,
multi: true,
deps: [AppConfigService]
}
],
bootstrap: [AppComponent]
})
export class AppModule { }
```

> Important to notice as APP_INITIALIZER  is supporting only promise() we return one. Also an advantage to that is it only gets bootstraped once the promise is resolved.

As result we can now access the configuration from the service by simple injecting and using it:

```typescript
//app.component.ts
app.component.ts
import { Component } from '@angular/core';
import { environment } from 'src/environments/environment';

import { AppConfigService } from './services/app-config.service';

@Component({
selector: 'app-root',
templateUrl: './app.component.html',
styleUrls: ['./app.component.css']
})
export class AppComponent {

constructor( private appConfigService: AppConfigService) {}

title = 'Build Once Deploy Multiple Times';
helloWorldEnvironment = environment.helloWorld;
helloWorldAppConfig = this.appConfigService.getConfig().helloWorld;
}
```
#### Dockerize

##### Dockerfile
Now you just need one Docker image to build

```dockerfile
FROM node:latest as node

WORKDIR /app

COPY src ./src
COPY angular.json .
COPY package.json .
COPY package-lock.json .
COPY tsconfig.app.json .
COPY tsconfig.json .
COPY tsconfig.spec.json .

RUN npm install
RUN npm run build --prod

FROM nginx:alpine
COPY --from=node /app/dist/angular-build-once-deploy-multiple /usr/share/nginx/html/
EXPOSE 80:80
```
##### Build Image
To build just use:

```shell
docker build -f Dockerfile -t angular_config .
```
##### Start Container
Of course, you now need to tell the container where the location of your configuration is. We assume that the configuration file is located within the working directory in configForDocker (change for your needs)

With Windows:
```shell
docker run -it --rm -v %cd%\configForDocker:/usr/share/nginx/html/assets/data -p 80:80 --name test_ui ui
```
With Unix Systems:
```shell
docker run -it --rm -v $(pwd)\configForDocker:/usr/share/nginx/html/assets/data -p 80:80 --name test_ui ui
```

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.
