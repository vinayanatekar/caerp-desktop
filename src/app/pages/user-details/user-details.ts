import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TauriService } from '../../services/tauri.service';
import { listen } from '@tauri-apps/api/event';

@Component({
  selector: 'app-user-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './user-details.html',
  styleUrl: './user-details.scss',
})
export class UserDetails implements OnInit, OnDestroy {
  userId!: number;
  client: any = null;
  session: any = null;
  loading = false;
  
  private unlistenFn: any = null;

  constructor(
    private route: ActivatedRoute,
    private tauriService: TauriService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.route.params.subscribe(async (params) => {
      this.userId = Number(params['id']);
      await this.loadClientDetails();
    });

    // Listen to real-time events from the Playwright background daemon to update the status pill dynamically
    if (this.tauriService.isTauriAvailable()) {
      try {
        this.unlistenFn = await listen('automation_event', async (event: any) => {
          const payload = event.payload;
          if (payload.event_type === 'success' || payload.event_type === 'error') {
            await this.refreshSession();
          }
        });
      } catch (err) {
        console.error('Failed to register tauri event listener:', err);
      }
    }
  }

  ngOnDestroy() {
    if (this.unlistenFn) {
      this.unlistenFn();
    }
  }

  async loadClientDetails() {
    this.loading = true;
    try {
      this.client = await this.tauriService.getClient(this.userId);
      this.session = await this.tauriService.getSessionStatus(this.userId);
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Failed to load client details:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async triggerAction(target: string) {
    this.loading = true;
    this.cdr.detectChanges();

    if (!this.tauriService.isTauriAvailable()) {
      // Mock browser simulation mode
      setTimeout(async () => {
        this.loading = false;
        await this.refreshSession();
      }, 3000);
      return;
    }

    // Tauri direct invocation mode
    try {
      await this.tauriService.openIncomeTax(this.userId, target);
      // Wait a moment and then check updated session in the background
      setTimeout(async () => {
        await this.refreshSession();
      }, 5000);
    } catch (err: any) {
      console.error(err);
      alert('Automation failed to trigger: ' + (err.message || err));
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async refreshSession() {
    try {
      this.session = await this.tauriService.refreshSessionStatus(this.userId);
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Failed to refresh session status:', err);
    }
  }
}
