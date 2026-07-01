| Test case ID | Scenario | Precondition | Steps | Expected result | Priority |
| --- | --- | --- | --- | --- | --- |
| `STU-AUTH-01` | Student dashboard authorization | User A is logged in as `student` | 1. Open `/student/dashboard` 2. Load dashboard data | Only User A's own summary is returned and rendered | High |
| `STU-AUTH-02` | Student route role guard | User is logged in as `lecturer` | 1. Open any `/student/*` route | User is redirected away from student pages | High |
| `STU-GROUP-01` | My group visibility | User A belongs to Group 1 | 1. Open `/student/my-group` | Only Group 1 info, members, progress and timeline are shown | High |
| `STU-GROUP-02` | No group assigned state | User has no active group | 1. Open `/student/my-group` | Empty state `Bạn chưa được phân vào nhóm nào.` is shown | Medium |
| `STU-TASK-01` | My tasks filtering by ownership | Group contains tasks for multiple members | 1. Open `/student/my-tasks` | Student only sees tasks assigned to themselves | High |
| `STU-TASK-02` | Start task transition | Student owns a task in `To Do` | 1. Click `Bắt đầu task` 2. Confirm modal | Task moves to `In Progress` and audit log is created | High |
| `STU-TASK-03` | Invalid task transition | Student owns a task already in `Approved` or `In Progress` | 1. Attempt to start task again | System blocks update with correct validation message | High |
| `STU-SUB-01` | Evidence submission on owned task | Student owns a task in `In Progress` | 1. Open `/student/tasks/:id/submit` 2. Fill valid form 3. Submit | Submission history record is created, task becomes `Submitted`, review status is `Pending Review`, audit log is created | High |
| `STU-SUB-02` | Submission blocked for foreign task | Task is assigned to another student | 1. Open submit route for that task | Student gets unauthorized state and cannot submit evidence | High |
| `STU-SUB-03` | Approved submission lock | Student owns a task already approved | 1. Open detail or submit page 2. Attempt to edit | Submission is locked and cannot be modified unless reopened later by leader | High |
| `STU-SUB-04` | Late submission flow | Student owns a task past deadline | 1. Submit valid evidence 2. Provide late reason | Submission is accepted, marked late and audit log records late reason | High |
| `STU-WLOG-01` | Create work log for self | Student has an active group | 1. Open `/student/work-logs` 2. Submit valid form | Work log is created for current student only and appears in list | High |
| `STU-WLOG-02` | Work log future date validation | Student opens create form | 1. Choose a future date 2. Save | Validation blocks save with future-date message | High |
| `STU-WLOG-03` | Work log milestone lock | Milestone/project is marked locked | 1. Open edit or delete action on a work log | Edit/delete actions are blocked | Medium |
| `STU-PR-01` | Peer review excludes self | Active review period exists | 1. Open `/student/peer-review` | Current student is excluded from the review target list | High |
| `STU-PR-02` | Peer review low-score comment requirement | Active review period exists | 1. Give any score of 1 or 2 2. Leave comment under 20 chars 3. Submit | Submission is blocked with comment-required validation | High |
| `STU-PR-03` | Peer review double-submit block | Student already submitted once in same period | 1. Re-open peer review page 2. Try to submit again | System shows completed state and blocks second submission | High |
| `STU-PR-04` | Peer review closed period | Review period status is `closed` | 1. Open peer review page 2. Attempt submit | System blocks submission with `Kỳ đánh giá đã đóng.` | High |
| `STU-CON-01` | Own contribution visibility only | User A and User B both have contribution data | 1. User A opens `/student/my-contribution` | User A only sees their own score, reasons, breakdown and evidence summary | High |
| `STU-CON-02` | Contribution empty state | Student has no task/evidence data | 1. Open contribution page | Empty state `Chưa có đủ dữ liệu để tính điểm đóng góp.` is shown | Medium |
| `STU-CON-03` | Risk reason clarity | Student is medium/high risk | 1. Open contribution page | Risk badge is shown together with concrete reasons such as late task, rejected task or missing evidence | High |
| `STU-FB-01` | Feedback visibility | User A and User B both have feedback | 1. User A opens `/student/feedback` | Only feedback addressed to User A is shown | High |
| `STU-FB-02` | Mark feedback as read | User has unread feedback | 1. Open feedback detail | Feedback becomes read and audit log is created | Medium |
| `STU-FB-03` | Reply to feedback when allowed | Feedback has `allowsReply=true` | 1. Open detail 2. Enter reply 3. Submit | Reply is saved, feedback stays immutable otherwise, audit log is created | Medium |
| `STU-APL-01` | Create appeal for self | Student has valid reason to appeal | 1. Open `/student/appeals` 2. Save draft | Draft appeal is created only for the current student | High |
| `STU-APL-02` | Appeal minimum content validation | Student opens new appeal form | 1. Enter explanation under 50 chars 2. Submit | Validation blocks submit | High |
| `STU-APL-03` | Submitted appeal becomes read-only | Appeal status is `submitted` | 1. Re-open same appeal | Student cannot edit unless it is reopened later by staff | High |
| `STU-APL-04` | Appeal does not auto-change score | Student submits appeal against low score | 1. Submit appeal 2. Refresh contribution page | Appeal status updates, but contribution score remains unchanged until lecturer action | High |
