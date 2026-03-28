import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashPassword, hashPasswordSync } from './auth/password';
import type {
  AppNotification,
  CreateRecordInput,
  CreateUserResult,
  DatabaseState,
  NotificationType,
  PracticeRecord,
  RecordFilters,
  RecordStatistics,
  RecordStatus,
  StudentRecord,
  TeacherRecord,
  TeacherRecordSummary,
  TeacherStatistics,
  TeacherStudentAssignment,
  UpdateRecordInput,
  User,
  UserRole
} from './models';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_FILE
  ? path.resolve(process.env.DATABASE_FILE)
  : path.join(currentDir, '..', 'database.json');
const uploadDir = path.join(currentDir, '..', 'uploads');

const validRoles: UserRole[] = ['admin', 'teacher', 'student'];
const validRecordStatuses: RecordStatus[] = ['approved', 'pending', 'rejected'];
const rolePrefixes: Record<UserRole, string> = {
  admin: 'A',
  teacher: 'T',
  student: 'S'
};
const uploadPathPattern = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
const deletedUserName = '已删除用户';

function nowIso() {
  return new Date().toISOString();
}

function toFiniteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nextNumericId(items: Array<{ id: number }>) {
  return items.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
}

function generatePlainPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
}

function isUserRole(value: unknown): value is UserRole {
  return validRoles.includes(value as UserRole);
}

function isRecordStatus(value: unknown): value is RecordStatus {
  return validRecordStatuses.includes(value as RecordStatus);
}

function createEmptyState(): DatabaseState {
  return {
    users: [],
    practice_records: [],
    notifications: [],
    teacher_students: [],
    nextId: {
      users: 1,
      practice_records: 1,
      notifications: 1
    },
    nextUidNumber: {
      admin: 1,
      teacher: 1,
      student: 1
    }
  };
}

function sanitizeUser(value: unknown): User | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<User>;

  if (
    typeof candidate.id !== 'number' ||
    typeof candidate.uid !== 'string' ||
    typeof candidate.password !== 'string' ||
    !isUserRole(candidate.role) ||
    typeof candidate.name !== 'string' ||
    typeof candidate.created_at !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    uid: candidate.uid,
    password: candidate.password,
    role: candidate.role,
    name: candidate.name,
    created_at: candidate.created_at
  };
}

function sanitizeRecord(value: unknown): PracticeRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<PracticeRecord>;

  if (
    typeof candidate.id !== 'number' ||
    typeof candidate.student_id !== 'number' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.content !== 'string' ||
    typeof candidate.practice_date !== 'string' ||
    typeof candidate.duration !== 'number' ||
    !isRecordStatus(candidate.status) ||
    typeof candidate.created_at !== 'string' ||
    typeof candidate.updated_at !== 'string'
  ) {
    return null;
  }

  if (candidate.location !== undefined && candidate.location !== null && typeof candidate.location !== 'string') {
    return null;
  }

  if (candidate.image_path !== undefined && candidate.image_path !== null && typeof candidate.image_path !== 'string') {
    return null;
  }

  if (candidate.teacher_comment !== undefined && candidate.teacher_comment !== null && typeof candidate.teacher_comment !== 'string') {
    return null;
  }

  if (candidate.student_uid_snapshot !== undefined && candidate.student_uid_snapshot !== null && typeof candidate.student_uid_snapshot !== 'string') {
    return null;
  }

  if (candidate.updated_by_uid !== undefined && candidate.updated_by_uid !== null && typeof candidate.updated_by_uid !== 'string') {
    return null;
  }

  return {
    id: candidate.id,
    student_id: candidate.student_id,
    student_uid_snapshot: candidate.student_uid_snapshot ?? null,
    title: candidate.title,
    content: candidate.content,
    practice_date: candidate.practice_date,
    location: candidate.location ?? null,
    duration: candidate.duration,
    image_path: candidate.image_path ?? null,
    status: candidate.status,
    teacher_comment: candidate.teacher_comment ?? null,
    created_at: candidate.created_at,
    updated_at: candidate.updated_at,
    updated_by_uid: candidate.updated_by_uid ?? null
  };
}

function sanitizeNotification(value: unknown): AppNotification | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<AppNotification>;

  if (
    typeof candidate.id !== 'number' ||
    typeof candidate.student_id !== 'number' ||
    typeof candidate.type !== 'string' ||
    typeof candidate.message !== 'string' ||
    typeof candidate.is_read !== 'boolean' ||
    typeof candidate.created_at !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    student_id: candidate.student_id,
    type: candidate.type as NotificationType,
    message: candidate.message,
    is_read: candidate.is_read,
    created_at: candidate.created_at
  };
}

function sanitizeAssignment(value: unknown): TeacherStudentAssignment | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<TeacherStudentAssignment>;

  if (typeof candidate.teacher_id !== 'number' || typeof candidate.student_id !== 'number') {
    return null;
  }

  return {
    teacher_id: candidate.teacher_id,
    student_id: candidate.student_id
  };
}

function sanitizeState(raw: unknown): DatabaseState {
  if (!raw || typeof raw !== 'object') {
    return createEmptyState();
  }

  const source = raw as Partial<DatabaseState>;
  const users = Array.isArray(source.users) ? source.users.map(sanitizeUser).filter(Boolean) as User[] : [];
  const records = Array.isArray(source.practice_records)
    ? source.practice_records.map(sanitizeRecord).filter(Boolean) as PracticeRecord[]
    : [];
  const notifications = Array.isArray(source.notifications)
    ? source.notifications.map(sanitizeNotification).filter(Boolean) as AppNotification[]
    : [];
  const assignments = Array.isArray(source.teacher_students)
    ? source.teacher_students.map(sanitizeAssignment).filter(Boolean) as TeacherStudentAssignment[]
    : [];
  const nextUid = source.nextUidNumber && typeof source.nextUidNumber === 'object'
    ? source.nextUidNumber as Partial<DatabaseState['nextUidNumber']>
    : {};

  return {
    users,
    practice_records: records,
    notifications,
    teacher_students: assignments,
    nextId: {
      users: Math.max(toFiniteNumber(source.nextId?.users, 0), nextNumericId(users)),
      practice_records: Math.max(toFiniteNumber(source.nextId?.practice_records, 0), nextNumericId(records)),
      notifications: Math.max(toFiniteNumber(source.nextId?.notifications, 0), nextNumericId(notifications))
    },
    nextUidNumber: {
      admin: toFiniteNumber(nextUid.admin, 1),
      teacher: toFiniteNumber(nextUid.teacher, 1),
      student: toFiniteNumber(nextUid.student, 1)
    }
  };
}

class JsonDatabase {
  readonly MAX_DAILY_RECORDS = 50;
  #state: DatabaseState = createEmptyState();

  constructor() {
    this.load();
    this.seedDefaults();
  }

  isValidRole(role: unknown): role is UserRole {
    return isUserRole(role);
  }

  findUserById(id: number) {
    return this.#state.users.find((user) => user.id === id);
  }

  findUserByUid(uid: string) {
    return this.#state.users.find((user) => user.uid === uid);
  }

  getUsersByRole(role?: UserRole) {
    const users = role
      ? this.#state.users.filter((user) => user.role === role)
      : this.#state.users;

    return users
      .map(({ id, uid, role: userRole, name, created_at }) => ({
        id,
        uid,
        role: userRole,
        name,
        created_at
      }))
      .sort((left, right) => right.id - left.id);
  }

  getAllStudents() {
    return this.#state.users
      .filter((user) => user.role === 'student')
      .map(({ id, uid, name, created_at }) => ({ id, uid, name, created_at }))
      .sort((left, right) => right.id - left.id);
  }

  async createUser(name: string, role: UserRole): Promise<CreateUserResult> {
    const password = generatePlainPassword();
    const user: User = {
      id: this.#state.nextId.users++,
      uid: this.generateUid(role),
      role,
      name,
      password: await hashPassword(password),
      created_at: nowIso()
    };

    this.#state.users.push(user);
    this.save();

    return {
      id: user.id,
      uid: user.uid,
      role: user.role,
      name: user.name,
      password
    };
  }

  async createUsers(entries: Array<{ name: string; role: UserRole }>) {
    const passwords = entries.map(() => generatePlainPassword());
    const hashes = await Promise.all(passwords.map((password) => hashPassword(password)));
    const timestamp = nowIso();
    const results: CreateUserResult[] = [];

    entries.forEach((entry, index) => {
      const user: User = {
        id: this.#state.nextId.users++,
        uid: this.generateUid(entry.role),
        role: entry.role,
        name: entry.name,
        password: hashes[index],
        created_at: timestamp
      };

      this.#state.users.push(user);
      results.push({
        id: user.id,
        uid: user.uid,
        role: user.role,
        name: user.name,
        password: passwords[index]
      });
    });

    this.save();
    return results;
  }

  updateUserName(id: number, name: string) {
    const user = this.findUserById(id);

    if (!user) {
      return false;
    }

    user.name = name;
    this.save();
    return true;
  }

  updateUserPassword(id: number, hashedPassword: string) {
    const user = this.findUserById(id);

    if (!user) {
      return false;
    }

    user.password = hashedPassword;
    this.save();
    return true;
  }

  async resetUserPasswords(ids: number[]) {
    const users = ids
      .map((id) => this.findUserById(id))
      .filter((user): user is User => Boolean(user));

    if (users.length === 0) {
      return [];
    }

    const passwords = users.map(() => generatePlainPassword());
    const hashes = await Promise.all(passwords.map((password) => hashPassword(password)));

    const results = users.map((user, index) => {
      user.password = hashes[index];

      return {
        id: user.id,
        uid: user.uid,
        role: user.role,
        name: user.name,
        password: passwords[index]
      };
    });

    this.save();
    return results;
  }

  deleteUser(id: number) {
    const index = this.#state.users.findIndex((user) => user.id === id);

    if (index === -1) {
      return false;
    }

    const [user] = this.#state.users.splice(index, 1);

    for (const record of this.#state.practice_records) {
      if (record.student_id === user.id && !record.student_uid_snapshot) {
        record.student_uid_snapshot = user.uid;
      }
    }

    if (user.role === 'teacher') {
      this.#state.teacher_students = this.#state.teacher_students.filter((assignment) => assignment.teacher_id !== user.id);
    }

    this.save();
    return true;
  }

  getTeacherStudents(teacherId: number) {
    const studentIds = new Set(this.getTeacherStudentIds(teacherId));

    return this.#state.users
      .filter((user) => user.role === 'student' && studentIds.has(user.id))
      .map(({ id, uid, name, created_at }) => ({ id, uid, name, created_at }))
      .sort((left, right) => right.id - left.id);
  }

  getTeacherStudentIds(teacherId: number) {
    return this.#state.teacher_students
      .filter((assignment) => assignment.teacher_id === teacherId)
      .map((assignment) => assignment.student_id);
  }

  getStudentTeacherId(studentId: number) {
    return this.#state.teacher_students.find((assignment) => assignment.student_id === studentId)?.teacher_id ?? null;
  }

  assignStudentsToTeacher(teacherId: number, studentIds: number[]) {
    for (const studentId of studentIds) {
      this.#state.teacher_students = this.#state.teacher_students.filter((assignment) => assignment.student_id !== studentId);
      this.#state.teacher_students.push({ teacher_id: teacherId, student_id: studentId });
    }

    this.save();
  }

  removeStudentsFromTeacher(teacherId: number, studentIds: number[]) {
    const ids = new Set(studentIds);
    this.#state.teacher_students = this.#state.teacher_students.filter((assignment) => {
      return !(assignment.teacher_id === teacherId && ids.has(assignment.student_id));
    });

    this.save();
  }

  getAllAssignments() {
    return [...this.#state.teacher_students];
  }

  createRecord(input: CreateRecordInput) {
    const student = this.findUserById(input.student_id);
    const timestamp = nowIso();
    const record: PracticeRecord = {
      id: this.#state.nextId.practice_records++,
      student_id: input.student_id,
      student_uid_snapshot: student?.uid ?? null,
      title: input.title,
      content: input.content,
      practice_date: input.practice_date,
      location: input.location,
      duration: input.duration,
      image_path: input.image_path,
      status: 'pending',
      teacher_comment: null,
      created_at: timestamp,
      updated_at: timestamp,
      updated_by_uid: null
    };

    this.#state.practice_records.push(record);
    this.save();
    return record;
  }

  getRecordById(id: number) {
    return this.#state.practice_records.find((record) => record.id === id) ?? null;
  }

  getRecordsByStudent(studentId: number): StudentRecord[] {
    return this.#state.practice_records
      .filter((record) => record.student_id === studentId)
      .map((record) => ({
        ...record,
        student_name: this.resolveStudentIdentity(record).student_name
      }))
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
  }

  getTeacherRecordById(id: number, visibleStudentIds?: Set<number>) {
    const record = this.getRecordById(id);

    if (!record) {
      return null;
    }

    if (visibleStudentIds && !visibleStudentIds.has(record.student_id)) {
      return null;
    }

    return {
      ...record,
      ...this.resolveStudentIdentity(record)
    };
  }

  getAllRecords(filters: RecordFilters = {}, visibleStudentIds?: Set<number>): TeacherRecordSummary[] {
    let records = [...this.#state.practice_records];

    if (visibleStudentIds) {
      records = records.filter((record) => visibleStudentIds.has(record.student_id));
    }

    if (filters.student_id) {
      records = records.filter((record) => record.student_id === filters.student_id);
    }

    if (filters.teacher_id) {
      records = records.filter((record) => this.getStudentTeacherId(record.student_id) === filters.teacher_id);
    }

    if (filters.status) {
      records = records.filter((record) => record.status === filters.status);
    }

    if (filters.practice_after) {
      records = records.filter((record) => record.practice_date >= filters.practice_after!);
    }

    if (filters.practice_before) {
      records = records.filter((record) => record.practice_date <= filters.practice_before!);
    }

    if (filters.created_after) {
      records = records.filter((record) => record.created_at >= filters.created_after!);
    }

    if (filters.created_before) {
      records = records.filter((record) => record.created_at <= filters.created_before!);
    }

    if (filters.updated_after) {
      records = records.filter((record) => record.updated_at >= filters.updated_after!);
    }

    if (filters.updated_before) {
      records = records.filter((record) => record.updated_at <= filters.updated_before!);
    }

    return records
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
      .map((record) => {
        const identity = this.resolveStudentIdentity(record);

        return {
          id: record.id,
          student_id: record.student_id,
          title: record.title,
          practice_date: record.practice_date,
          status: record.status,
          created_at: record.created_at,
          student_name: identity.student_name,
          student_uid: identity.student_uid
        };
      });
  }

  updateRecord(id: number, updates: UpdateRecordInput) {
    const index = this.#state.practice_records.findIndex((record) => record.id === id);

    if (index === -1) {
      return null;
    }

    const current = this.#state.practice_records[index];
    const next: PracticeRecord = {
      ...current,
      ...updates,
      updated_at: nowIso()
    };

    this.#state.practice_records[index] = next;
    this.save();

    if (current.image_path !== next.image_path) {
      this.removeUnusedUpload(current.image_path, next.id);
    }

    return next;
  }

  deleteRecord(id: number) {
    const index = this.#state.practice_records.findIndex((record) => record.id === id);

    if (index === -1) {
      return false;
    }

    const [removed] = this.#state.practice_records.splice(index, 1);
    this.save();
    this.removeUnusedUpload(removed.image_path);
    return true;
  }

  countStudentRecordsToday(studentId: number) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();

    return this.#state.practice_records.filter((record) => {
      return record.student_id === studentId && Date.parse(record.created_at) >= startMs;
    }).length;
  }

  createNotification(studentId: number, type: NotificationType, message: string) {
    const notification: AppNotification = {
      id: this.#state.nextId.notifications++,
      student_id: studentId,
      type,
      message,
      is_read: false,
      created_at: nowIso()
    };

    this.#state.notifications.push(notification);
    this.save();
    return notification;
  }

  getNotificationsByStudent(studentId: number) {
    return this.#state.notifications
      .filter((notification) => notification.student_id === studentId)
      .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
  }

  getUnreadNotificationCount(studentId: number) {
    return this.#state.notifications.filter((notification) => {
      return notification.student_id === studentId && !notification.is_read;
    }).length;
  }

  markNotificationsAsRead(studentId: number) {
    let changed = false;

    for (const notification of this.#state.notifications) {
      if (notification.student_id === studentId && !notification.is_read) {
        notification.is_read = true;
        changed = true;
      }
    }

    if (changed) {
      this.save();
    }
  }

  getStudentStatistics(studentId: number) {
    return this.calculateRecordStatistics(
      this.#state.practice_records.filter((record) => record.student_id === studentId)
    );
  }

  getStatistics(visibleStudentIds?: Set<number>): TeacherStatistics {
    const students = visibleStudentIds
      ? this.#state.users.filter((user) => user.role === 'student' && visibleStudentIds.has(user.id))
      : this.#state.users.filter((user) => user.role === 'student');

    const records = visibleStudentIds
      ? this.#state.practice_records.filter((record) => visibleStudentIds.has(record.student_id))
      : this.#state.practice_records;

    const base = this.calculateRecordStatistics(records);

    const student_durations = students
      .map((student) => ({
        student_id: student.id,
        student_name: student.name,
        student_uid: student.uid,
        total_duration: records.reduce((total, record) => {
          if (record.student_id !== student.id || record.status !== 'approved') {
            return total;
          }

          return total + record.duration;
        }, 0)
      }))
      .sort((left, right) => {
        if (right.total_duration !== left.total_duration) {
          return right.total_duration - left.total_duration;
        }

        return left.student_name.localeCompare(right.student_name);
      });

    return {
      ...base,
      student_count: students.length,
      student_durations
    };
  }

  #loadFromDisk() {
    if (!fs.existsSync(dbPath)) {
      return createEmptyState();
    }

    try {
      const raw = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as unknown;
      return sanitizeState(raw);
    } catch (error) {
      console.warn('数据库文件解析失败，将使用新的数据存储。', error);
      return createEmptyState();
    }
  }

  private load() {
    this.#state = this.#loadFromDisk();
  }

  private save() {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(this.#state, null, 2), 'utf8');
  }

  private seedDefaults() {
    if (this.#state.users.length > 0) {
      return;
    }

    const password = hashPasswordSync('12345678');
    const timestamp = nowIso();

    this.#state.users.push(
      {
        id: this.#state.nextId.users++,
        uid: this.generateUid('admin'),
        role: 'admin',
        name: '超级奶龙',
        password,
        created_at: timestamp
      },
      {
        id: this.#state.nextId.users++,
        uid: this.generateUid('teacher'),
        role: 'teacher',
        name: '教师一',
        password,
        created_at: timestamp
      },
      {
        id: this.#state.nextId.users++,
        uid: this.generateUid('student'),
        role: 'student',
        name: '学生一',
        password,
        created_at: timestamp
      },
      {
        id: this.#state.nextId.users++,
        uid: this.generateUid('student'),
        role: 'student',
        name: '学生二',
        password,
        created_at: timestamp
      }
    );

    this.save();
  }

  private generateUid(role: UserRole) {
    const prefix = rolePrefixes[role];
    const next = this.#state.nextUidNumber[role]++;
    return `${prefix}${next.toString(16).padStart(5, '0')}`;
  }

  private resolveStudentIdentity(record: Pick<PracticeRecord, 'student_id' | 'student_uid_snapshot'>) {
    const student = this.findUserById(record.student_id);

    if (student) {
      return {
        student_name: student.name,
        student_uid: student.uid
      };
    }

    return {
      student_name: deletedUserName,
      student_uid: record.student_uid_snapshot ?? ''
    };
  }

  private resolveUploadFilePath(imagePath: string) {
    if (!uploadPathPattern.test(imagePath)) {
      return null;
    }

    const filePath = path.join(uploadDir, path.basename(imagePath));

    if (!filePath.startsWith(uploadDir)) {
      return null;
    }

    return filePath;
  }

  private removeUploadFile(imagePath: string | null) {
    if (!imagePath) {
      return;
    }

    const filePath = this.resolveUploadFilePath(imagePath);

    if (!filePath || !fs.existsSync(filePath)) {
      return;
    }

    fs.unlinkSync(filePath);
  }

  private removeUnusedUpload(imagePath: string | null, ignoredRecordId?: number) {
    if (!imagePath) {
      return;
    }

    const stillUsed = this.#state.practice_records.some((record) => {
      return record.id !== ignoredRecordId && record.image_path === imagePath;
    });

    if (!stillUsed) {
      this.removeUploadFile(imagePath);
    }
  }

  private calculateRecordStatistics(records: Pick<PracticeRecord, 'status' | 'duration'>[]): RecordStatistics {
    return {
      total_records: records.length,
      pending_count: records.filter((record) => record.status === 'pending').length,
      approved_count: records.filter((record) => record.status === 'approved').length,
      rejected_count: records.filter((record) => record.status === 'rejected').length,
      total_duration: records.reduce((total, record) => {
        return record.status === 'approved' ? total + record.duration : total;
      }, 0)
    };
  }
}

const database = new JsonDatabase();

export default database;
