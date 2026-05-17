import type {
  AppNotification,
  ClassAssignments,
  ClassStudentAssignment,
  ClassSummary,
  ClassTeacherAssignment,
  CreateUserResult,
  CsvImportEntry,
  CsvImportPreview,
  NotificationType,
  PublicUser,
  RecordStatistics,
  RecordStatus,
  StudentRecord,
  StudentSummary,
  StudentWithClassSummary,
  TeacherRecord,
  TeacherRecordSummary,
  TeacherStatistics,
  UploadResult,
  UserRole,
  UserSummary
} from '../../../backend/src/models';

export const API_URL = '/api';

export type {
  AppNotification,
  ClassAssignments,
  ClassStudentAssignment,
  ClassSummary,
  ClassTeacherAssignment,
  CsvImportEntry,
  CsvImportPreview,
  NotificationType,
  RecordStatistics,
  RecordStatus,
  StudentRecord,
  StudentSummary,
  StudentWithClassSummary,
  TeacherRecord,
  TeacherRecordSummary,
  TeacherStatistics,
  UploadResult,
  UserRole,
  UserSummary
};

export type CreatedUser = CreateUserResult;
export type StoredUser = PublicUser;

export interface ApiError {
  error?: string;
}
