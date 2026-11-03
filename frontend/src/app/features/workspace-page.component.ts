import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RequestService } from '../core/api.service';
import { RequestStore } from '../state/request.store';
import { EmptyStateComponent } from '../shared/empty-state.component';
import { PageHeaderComponent } from '../shared/page-header.component';

type Step = 0 | 1 | 2;

/** The request wizard: project details, team, then review and submit. Equipment is chosen in the cart. */
@Component({
  selector: 'jhub-workspace-page',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-page.component.html',
  styleUrl: './workspace-page.component.css'
})
export class WorkspacePageComponent {
  protected readonly request = inject(RequestStore);
  private readonly requestService = inject(RequestService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly stepNames = ['Project', 'Team', 'Review'];
  protected readonly step = signal<Step>(0);
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly members = computed(() => this.request.draft().teamMembers);
  protected readonly submitting = computed(() => this.request.submission().status === 'SUBMITTING');
  protected readonly submitError = computed(() => this.request.submission().status === 'ERROR' ? this.request.submission().error : null);

  protected readonly projectForm = this.fb.nonNullable.group({
    projectName: ['', [Validators.required, Validators.maxLength(120)]],
    projectAbstract: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(2000)]],
    loanDays: [7, [Validators.required, Validators.min(1), Validators.max(365)]],
    startDate: ['', Validators.required]
  });

  protected readonly memberForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9 ()-]{9,}$/)]],
    studentOrIdNo: ['', Validators.required],
    role: ['', Validators.required]
  });

  constructor() {
    const draft = this.request.draft();
    if (draft.projectName) {
      this.projectForm.patchValue({
        projectName: draft.projectName,
        projectAbstract: draft.projectAbstract,
        loanDays: draft.loanDays,
        startDate: draft.startDate
      });
    }
  }

  protected invalid(form: 'project' | 'member', field: string): boolean {
    const group: FormGroup = form === 'project' ? this.projectForm : this.memberForm;
    const control = group.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  protected goTo(step: Step): void {
    if (step < this.step()) this.step.set(step);
  }

  protected back(): void {
    this.step.set(Math.max(0, this.step() - 1) as Step);
  }

  protected saveProject(): void {
    this.projectForm.markAllAsTouched();
    if (this.projectForm.invalid) return;
    this.request.updateProject(this.projectForm.getRawValue());
    this.step.set(1);
  }

  protected addMember(): void {
    this.memberForm.markAllAsTouched();
    if (this.memberForm.invalid) return;
    const member = this.memberForm.getRawValue();
    this.request.addTeamMember({
      fullName: member.name,
      name: member.name,
      email: member.email,
      phoneNumber: member.phone,
      roleInProject: member.role,
      role: member.role,
      studentOrIdNo: member.studentOrIdNo
    });
    this.memberForm.reset();
  }

  protected removeMember(index: number): void {
    this.request.removeTeamMember(index);
  }

  protected toReview(): void {
    this.step.set(2);
  }

  protected submit(): void {
    const draft = this.request.draft();
    if (!draft.items.length || this.submitting()) return;
    this.request.beginSubmission();
    this.requestService
      .create({
        projectName: draft.projectName,
        projectAbstract: draft.projectAbstract,
        loanDays: draft.loanDays,
        startDate: draft.startDate,
        items: draft.items.map(item => ({ assetId: item.assetId, quantity: item.quantity })),
        teamMembers: draft.teamMembers.map(member => ({
          fullName: member.fullName,
          email: member.email,
          phoneNumber: member.phoneNumber,
          studentOrIdNo: member.studentOrIdNo,
          roleInProject: member.roleInProject
        }))
      })
      .subscribe({
        next: created => {
          this.request.completeSubmission(created.id);
          this.request.clearItems();
          void this.router.navigateByUrl('/app/requests/submitted');
        },
        error: () => this.request.failSubmission('We couldn’t submit your request. Check that the equipment is still in stock, then try again.')
      });
  }
}
