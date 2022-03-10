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
