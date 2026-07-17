import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';

@Injectable({
  providedIn: 'root'
})
export class TauriService {

  isTauriAvailable(): boolean {
    return typeof window !== 'undefined' && (
      (window as any).__TAURI_INTERNALS__ !== undefined || 
      (window as any).__TAURI__ !== undefined
    );
  }

  async addClient(user: any): Promise<string> {
    if (!this.isTauriAvailable()) {
      console.warn('Tauri is not available. Using mock addClient.');
      return 'Client added successfully (Mock)';
    }
    return await invoke('add_client', { user });
  }

  async getClients(): Promise<any[]> {
    if (!this.isTauriAvailable()) {
      console.warn('Tauri is not available. Using mock getClients.');
      return [
        { id: 1, pan: 'BEVPN1882D', name: 'VINAYA SUDHAKAR NATEKAR', mobile: '7709355069', email: 'vinayanatekar@gmail.com', dob: '1992-07-27' },
        { id: 2, pan: 'BFGJKG1572', name: 'Priya Natekar', mobile: '9765139923', email: 'sudhanatekar@gmail.com', dob: '1963-07-22' },
        { id: 3, pan: 'BEVPNGH784', name: 'SF Client', mobile: '9923570323', email: 'fvaef@gmail.com', dob: '1965-08-25' }
      ];
    }
    return await invoke('get_clients');
  }

  async openIncomeTax(userId: number, target: string = 'portal') {
    if (!this.isTauriAvailable()) {
      console.warn('Tauri is not available. Cannot open headed browser.');
      throw new Error('Running in browser preview. Please launch the desktop Tauri application to run Playwright.');
    }
    return await invoke('open_income_tax', { userId, target });
  }

  async getSessionStatus(userId: number): Promise<any> {
    if (!this.isTauriAvailable()) {
      console.warn('Tauri is not available. Using mock getSessionStatus.');
      return {
        id: 1,
        user_id: userId,
        portal_name: 'Income Tax Portal',
        session_status: 'Not Checked',
        browser_profile: 'automation/.user_data/MOCKPAN',
        last_login_time: null,
        last_checked_time: null
      };
    }
    return await invoke('get_session_status', { userId });
  }

  async refreshSessionStatus(userId: number): Promise<any> {
    if (!this.isTauriAvailable()) {
      console.warn('Tauri is not available. Using mock refreshSessionStatus.');
      return {
        id: 1,
        user_id: userId,
        portal_name: 'Income Tax Portal',
        session_status: 'Logged In',
        browser_profile: 'automation/.user_data/MOCKPAN',
        last_login_time: '17 Jul 2026',
        last_checked_time: new Date().toLocaleString()
      };
    }
    return await invoke('refresh_session_status', { userId });
  }

  async getClient(id: number): Promise<any> {
    if (!this.isTauriAvailable()) {
      console.warn('Tauri is not available. Using mock getClient.');
      const clients = [
        { id: 1, pan: 'BEVPN1882D', name: 'VINAYA SUDHAKAR NATEKAR', mobile: '7709355069', email: 'vinayanatekar@gmail.com', dob: '1992-07-27' },
        { id: 2, pan: 'BFGJKG1572', name: 'Priya Natekar', mobile: '9765139923', email: 'sudhanatekar@gmail.com', dob: '1963-07-22' },
        { id: 3, pan: 'BEVPNGH784', name: 'SF Client', mobile: '9923570323', email: 'fvaef@gmail.com', dob: '1965-08-25' }
      ];
      return clients.find(c => c.id === id) || clients[0];
    }
    return await invoke('get_client', { id });
  }
}