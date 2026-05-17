import type {
  AppNotification,
  CreateUserResult,
  CsvImportEntry,
  CsvImportPreview,
  NotificationType,
  PublicUser,
  RecordStatistics,
  RecordStatus,
  StudentRecord,
  StudentSummary,
  TeacherRecord,
  TeacherRecordSummary,
  TeacherStatistics,
  TeacherStudentAssignment,
  UploadResult,
  UserRole,
  UserSummary
} from '../../../backend/src/models';

export const API_URL = '/api';

export type {
  AppNotification,
  CsvImportEntry,
  CsvImportPreview,
  NotificationType,
  RecordStatistics,
  RecordStatus,
  StudentRecord,
  StudentSummary,
  TeacherRecord,
  TeacherRecordSummary,
  TeacherStatistics,
  UploadResult,
  UserRole,
  UserSummary
};

export type Assignment = TeacherStudentAssignment;
export type CreatedUser = CreateUserResult;
export type StoredUser = PublicUser;

export interface ApiError {
  error?: string;
}
