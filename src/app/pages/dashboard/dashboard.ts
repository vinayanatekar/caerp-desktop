import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TauriService } from '../../services/tauri.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  clients: any[] = [];
  loading = true;
  totalClients = 0;
  loadingStates: { [id: number]: boolean } = {};

  constructor(
    private tauriService: TauriService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.loadDashboardData();
  }

  async loadDashboardData() {
    this.loading = true;
    try {
      this.clients = await this.tauriService.getClients();
      this.totalClients = this.clients.length;
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async openIncomeTaxPortal(userId: number) {
    this.loadingStates[userId] = true;
    this.cdr.detectChanges();
    try {
      await this.tauriService.openIncomeTax(userId);
    } catch (err: any) {
      console.error(err);
      alert('Failed to launch portal: ' + (err.message || err));
    } finally {
      this.loadingStates[userId] = false;
      this.cdr.detectChanges();
    }
  }
}
