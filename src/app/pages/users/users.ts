import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { TauriService } from '../../services/tauri.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './users.html',
  styleUrl: './users.scss'
})
export class Users implements OnInit {

  users: any[] = [];
  loadingStates: { [id: number]: boolean } = {};

  constructor(
    private tauriService: TauriService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.loadUsers();
  }

  async loadUsers() {
    this.users = await this.tauriService.getClients();
    console.log(this.users);
    this.cdr.detectChanges();
  }

  async openIncomeTaxPortal(userId: number) {
    this.loadingStates[userId] = true;
    try {
      await this.tauriService.openIncomeTax(userId);
    } catch (err: any) {
      console.error(err);
      alert('Failed to launch portal: ' + (err.message || err));
    } finally {
      this.loadingStates[userId] = false;
    }
  }
}