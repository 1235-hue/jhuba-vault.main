import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('renders the landing page headline and primary sections', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Build what');
    expect(fixture.nativeElement.querySelector('#catalogue')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#workflow')).not.toBeNull();
  });
});
