import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrainingMeetingComponent } from './training-meeting.component';

describe('TrainingMeetingComponent', () => {
  let component: TrainingMeetingComponent;
  let fixture: ComponentFixture<TrainingMeetingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrainingMeetingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrainingMeetingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
