import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PostJobsComponent } from './post-jobs.component';

describe('PostJobsComponent', () => {
  let component: PostJobsComponent;
  let fixture: ComponentFixture<PostJobsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostJobsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PostJobsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
