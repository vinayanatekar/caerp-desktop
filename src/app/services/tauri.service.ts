import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';

@Injectable({
  providedIn: 'root'
})
export class TauriService {

  async addClient(user: any): Promise<string> {
    return await invoke('add_client', { user });
  }

  async getClients(): Promise<any[]> {
    return await invoke('get_clients');
  }

}