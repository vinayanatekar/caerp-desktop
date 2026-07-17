import { Routes } from '@angular/router';

import { Dashboard } from './pages/dashboard/dashboard';
import { Users } from './pages/users/users';
import { AddUser } from './pages/add-user/add-user';
import { UserDetails } from './pages/user-details/user-details';


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
    path: 'users/:id',
    component: UserDetails
  },
  {
    path: 'add-user',
    component: AddUser
  },
  
];
