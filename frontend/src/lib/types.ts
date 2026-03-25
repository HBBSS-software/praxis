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
  TeacherStatistics,
  TeacherStudentAssignment,
  UploadResult,
  UserRole,
  UserSummary
} from '../../../backend/src/models';

const envApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');

export const API_URL = envApiUrl || '/api';

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
