import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployerSettingsComponent } from './settings.component'; // ✅ correct name

describe('EmployerSettingsComponent', () => {
  let component: EmployerSettingsComponent;
  let fixture: ComponentFixture<EmployerSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployerSettingsComponent] // ✅
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmployerSettingsComponent); // ✅
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});