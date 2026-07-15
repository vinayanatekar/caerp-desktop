import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { TauriService } from '../../services/tauri.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule
  ],
  templateUrl: './users.html',
  styleUrl: './users.scss'
})
export class Users implements OnInit {

  users: any[] = [];

  constructor(private tauriService: TauriService) {}

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {

    this.users = await this.tauriService.getClients();

    console.log(this.users);

  }

  async openIncomeTaxPortal(userId: number) {
    try {
      await this.tauriService.openIncomeTax(userId);
    } catch (err) {
      console.error(err);
    }
  }

}