import { Routes } from '@angular/router';

import { Dashboard } from './pages/dashboard/dashboard';
import { Users } from './pages/users/users';
import { AddUser } from './pages/add-user/add-user';


export const routes: Routes = [
  {
    path: '',
    component: Dashboard
  },
  {
    path: 'users',
    component: Users
  },
  {
    path: 'add-user',
    component: AddUser
  },
  
];
