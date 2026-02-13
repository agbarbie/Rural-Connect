import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobExplorerComponent } from './job-explorer.component';

describe('JobSearchComponent', () => {
  let component: JobExplorerComponent;
  let fixture: ComponentFixture<JobExplorerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobExplorerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JobExplorerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
