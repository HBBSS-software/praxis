import {
  API_URL,
  escapeHtml,
  formatDate,
  formatDateTime,
  getApiOrigin,
  logout,
  populateUserSummary,
  readJson,
  requireElement,
  requireRole,
  type ApiError
} from '../shared';

type RecordStatus = 'approved' | 'pending' | 'rejected';

interface StudentOption {
  id: number;
  name: string;
}

interface TeacherRecord {
  id: number;
  student_name: string;
  student_username: string;
  title: string;
  content: string;
  practice_date: string;
  duration: number | null;
  location: string | null;
  image_path: string | null;
  status: RecordStatus;
  teacher_comment: string | null;
  created_at: string;
}

interface StudentsResponse extends ApiError {
  students: StudentOption[];
}

interface TeacherRecordsResponse extends ApiError {
  records: TeacherRecord[];
}

interface TeacherRecordResponse extends ApiError {
  record: TeacherRecord;
}

interface StatisticsResponse extends ApiError {
  statistics: {
    approved_count: number;
    pending_count: number;
    student_count: number;
    total_records: number;
  };
}

const session = requireRole('teacher', '../login.html');

if (session) {
  const activeSession = session;
  const logoutButton = requireElement<HTMLButtonElement>('#logout-button');
  const studentFilter = requireElement<HTMLSelectElement>('#filter-student');
  const statusFilter = requireElement<HTMLSelectElement>('#filter-status');
  const refreshButton = requireElement<HTMLButtonElement>('#refresh-records-button');
  const recordsTable = requireElement<HTMLElement>('#records-table');
  const totalCount = requireElement<HTMLElement>('#total-count');
  const pendingCount = requireElement<HTMLElement>('#pending-count');
  const approvedCount = requireElement<HTMLElement>('#approved-count');
  const studentCount = requireElement<HTMLElement>('#student-count');
  const reviewModal = requireElement<HTMLElement>('#review-modal');
  const modalContent = requireElement<HTMLElement>('#modal-content');
  const reviewComment = requireElement<HTMLTextAreaElement>('#review-comment');
  const closeModalButton = requireElement<HTMLButtonElement>('#close-review-modal');
  const cancelReviewButton = requireElement<HTMLButtonElement>('#cancel-review-button');
  const rejectReviewButton = requireElement<HTMLButtonElement>('#reject-review-button');
  const approveReviewButton = requireElement<HTMLButtonElement>('#approve-review-button');

  let currentRecordId: number | null = null;

  populateUserSummary('#user-name', '#user-avatar', activeSession.user);
  logoutButton.addEventListener('click', () => logout('../login.html'));
  studentFilter.addEventListener('change', () => {
    void loadRecords(activeSession.token, studentFilter, statusFilter, recordsTable);
  });
  statusFilter.addEventListener('change', () => {
    void loadRecords(activeSession.token, studentFilter, statusFilter, recordsTable);
  });
  refreshButton.addEventListener('click', () => {
    void loadRecords(activeSession.token, studentFilter, statusFilter, recordsTable);
    void loadStatistics(activeSession.token, totalCount, pendingCount, approvedCount, studentCount);
  });
  closeModalButton.addEventListener('click', () => closeModal(reviewModal, reviewComment, () => {
    currentRecordId = null;
  }));
  cancelReviewButton.addEventListener('click', () => closeModal(reviewModal, reviewComment, () => {
    currentRecordId = null;
  }));
  rejectReviewButton.addEventListener('click', () => {
    void submitReview('rejected');
  });
  approveReviewButton.addEventListener('click', () => {
    void submitReview('approved');
  });
  reviewModal.addEventListener('click', (event) => {
    if (event.target === reviewModal) {
      closeModal(reviewModal, reviewComment, () => {
        currentRecordId = null;
      });
    }
  });
  recordsTable.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    const button = target?.closest<HTMLButtonElement>('[data-action="open-review"]');

    if (!button) {
      return;
    }

    const recordId = Number(button.dataset.recordId);

    if (!Number.isFinite(recordId)) {
      return;
    }

    void openReviewModal(recordId);
  });

  void loadStudents(activeSession.token, studentFilter);
  void loadRecords(activeSession.token, studentFilter, statusFilter, recordsTable);
  void loadStatistics(activeSession.token, totalCount, pendingCount, approvedCount, studentCount);

  async function openReviewModal(recordId: number): Promise<void> {
    currentRecordId = recordId;

    try {
      const response = await fetch(`${API_URL}/teacher/records/${recordId}`, {
        headers: { Authorization: `Bearer ${activeSession.token}` }
      });

      if (response.status === 401) {
        logout('../login.html');
        return;
      }

      const data = await readJson<TeacherRecordResponse>(response);

      if (!response.ok || !data) {
        throw new Error(data?.error ?? 'Unable to load record details.');
      }

      const record = data.record;

      modalContent.innerHTML = `
        <div style="margin-bottom: 16px;">
          <strong>Student:</strong> ${escapeHtml(record.student_name)}
        </div>
        <div style="margin-bottom: 16px;">
          <strong>Title:</strong> ${escapeHtml(record.title)}
        </div>
        <div style="margin-bottom: 16px;">
          <strong>Practice date:</strong> ${formatDate(record.practice_date, '-')}
          ${record.duration ? ` | <strong>Duration:</strong> ${record.duration} hours` : ''}
          ${record.location ? ` | <strong>Location:</strong> ${escapeHtml(record.location)}` : ''}
        </div>
        <div style="margin-bottom: 16px;">
          <strong>Content:</strong>
          <p style="margin-top: 8px; padding: 12px; background: var(--gray-100); border-radius: 8px;">
            ${escapeHtml(record.content)}
          </p>
        </div>
        ${
          record.image_path
            ? `<div>
                <strong>Image:</strong>
                <img
                  src="${getApiOrigin()}${record.image_path}"
                  alt="${escapeHtml(record.title)}"
                  style="max-width: 100%; max-height: 300px; margin-top: 8px; border-radius: 8px;"
                >
              </div>`
            : ''
        }
        ${
          record.teacher_comment
            ? `<div style="margin-top: 16px; padding: 12px; background: #dbeafe; border-radius: 8px;">
                <strong>Current comment:</strong> ${escapeHtml(record.teacher_comment)}
              </div>`
            : ''
        }
      `;

      reviewComment.value = record.teacher_comment ?? '';
      reviewModal.classList.add('show');
    } catch (error) {
      console.error('Failed to load record detail.', error);
      window.alert('Unable to load record details.');
    }
  }

  async function submitReview(status: 'approved' | 'rejected'): Promise<void> {
    if (!currentRecordId) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/teacher/records/${currentRecordId}/review`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeSession.token}`
        },
        body: JSON.stringify({
          status,
          comment: reviewComment.value.trim()
        })
      });

      if (response.status === 401) {
        logout('../login.html');
        return;
      }

      const data = await readJson<ApiError>(response);

      if (!response.ok) {
        throw new Error(data?.error ?? 'Unable to save the review.');
      }

      closeModal(reviewModal, reviewComment, () => {
        currentRecordId = null;
      });
      await loadRecords(activeSession.token, studentFilter, statusFilter, recordsTable);
      await loadStatistics(activeSession.token, totalCount, pendingCount, approvedCount, studentCount);
    } catch (error) {
      console.error('Failed to submit review.', error);
      window.alert(error instanceof Error ? error.message : 'Unable to save the review.');
    }
  }
}

async function loadStudents(token: string, studentFilter: HTMLSelectElement): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/teacher/students`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
      logout('../login.html');
      return;
    }

    const data = await readJson<StudentsResponse>(response);

    if (!response.ok || !data) {
      throw new Error(data?.error ?? 'Unable to load students.');
    }

    studentFilter.innerHTML = `
      <option value="">All students</option>
      ${data.students
        .map((student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`)
        .join('')}
    `;
  } catch (error) {
    console.error('Failed to load students.', error);
  }
}

async function loadRecords(
  token: string,
  studentFilter: HTMLSelectElement,
  statusFilter: HTMLSelectElement,
  recordsTable: HTMLElement
): Promise<void> {
  try {
    const query = new URLSearchParams();

    if (studentFilter.value) {
      query.set('student_id', studentFilter.value);
    }

    if (statusFilter.value) {
      query.set('status', statusFilter.value);
    }

    const url = `${API_URL}/teacher/records${query.toString() ? `?${query.toString()}` : ''}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
      logout('../login.html');
      return;
    }

    const data = await readJson<TeacherRecordsResponse>(response);

    if (!response.ok || !data) {
      throw new Error(data?.error ?? 'Unable to load records.');
    }

    renderRecords(recordsTable, data.records);
  } catch (error) {
    console.error('Failed to load records.', error);
    recordsTable.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--danger);">
          Unable to load records.
        </td>
      </tr>
    `;
  }
}

async function loadStatistics(
  token: string,
  totalCount: HTMLElement,
  pendingCount: HTMLElement,
  approvedCount: HTMLElement,
  studentCount: HTMLElement
): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/teacher/statistics`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
      logout('../login.html');
      return;
    }

    const data = await readJson<StatisticsResponse>(response);

    if (!response.ok || !data) {
      throw new Error(data?.error ?? 'Unable to load statistics.');
    }

    totalCount.textContent = String(data.statistics.total_records);
    pendingCount.textContent = String(data.statistics.pending_count);
    approvedCount.textContent = String(data.statistics.approved_count);
    studentCount.textContent = String(data.statistics.student_count);
  } catch (error) {
    console.error('Failed to load statistics.', error);
  }
}

function renderRecords(recordsTable: HTMLElement, records: TeacherRecord[]): void {
  if (records.length === 0) {
    recordsTable.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px;">
          <div class="empty-state" style="padding: 20px;">
            <p>No records found.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  recordsTable.innerHTML = records
    .map(
      (record) => `
        <tr>
          <td><strong>${escapeHtml(record.student_name)}</strong></td>
          <td>${escapeHtml(record.title)}</td>
          <td>${formatDate(record.practice_date, '-')}</td>
          <td>${record.duration ? `${record.duration} hours` : '-'}</td>
          <td>
            <span class="status-badge status-${record.status}">
              ${statusLabel(record.status)}
            </span>
          </td>
          <td>${formatDateTime(record.created_at)}</td>
          <td>
            <button
              class="btn btn-sm"
              type="button"
              data-action="open-review"
              data-record-id="${record.id}"
              style="background: var(--primary); color: white;"
            >
              Review
            </button>
          </td>
        </tr>
      `
    )
    .join('');
}

function closeModal(
  reviewModal: HTMLElement,
  reviewComment: HTMLTextAreaElement,
  onClose: () => void
): void {
  reviewModal.classList.remove('show');
  reviewComment.value = '';
  onClose();
}

function statusLabel(status: RecordStatus): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Pending';
  }
}
