import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { TauriService } from '../../services/tauri.service';

@Component({
  selector: 'app-add-user',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './add-user.html',
  styleUrl: './add-user.scss'
})
export class AddUser {

  userForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private tauriService: TauriService,
    private router: Router
  ) {
    this.userForm = this.fb.group({
      pan: [
        '',
        [
          Validators.required,
          Validators.minLength(10),
          Validators.maxLength(10)
        ]
      ],
      password: ['', Validators.required],
      name: ['', Validators.required],
      mobile: [''],
      email: [''],
      dob: ['']
    });
  }

  async saveUser() {

    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    try {

      const result = await this.tauriService.addClient(
        this.userForm.getRawValue()
      );

      console.log(result);

      alert('Client saved successfully.');

      this.userForm.reset();
      await this.router.navigate(['/users']);

    } catch (error) {

      console.error(error);

      alert('Failed to save client.');

    }
  }

}