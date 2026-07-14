import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Sidebar } from './layout/sidebar/sidebar';
import { Toolbar } from './layout/toolbar/toolbar';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    Sidebar,
    Toolbar
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}