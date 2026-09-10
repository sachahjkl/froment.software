import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { Team } from './team';

@Component({
  host: { class: 'page-container' },
  imports: [FormField, RouterLink, Button, Notice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-team-invitation',
  styleUrl: './team-invitation.scss',
  templateUrl: './team-invitation.html',
})
export class TeamInvitation extends Team {}
