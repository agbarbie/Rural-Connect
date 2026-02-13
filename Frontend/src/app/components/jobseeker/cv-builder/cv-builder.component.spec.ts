import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CvBuilderComponent } from './cv-builder.component';

describe('CvBuilderComponent', () => {
  let component: CvBuilderComponent;
  let fixture: ComponentFixture<CvBuilderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CvBuilderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CvBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
