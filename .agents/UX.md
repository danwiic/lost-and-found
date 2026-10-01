# UX Behavior Specification

## Lost & Found System with Image Matching

This document defines **interaction behavior and UX rules** for the Lost & Found web system. It is intentionally separate from the visual design system.

The visual design may change, but these behavioral rules should remain consistent.

---

# 1. UX Principles

## 1.1 Clarity over decoration

Users should immediately understand:

- what they are looking at
- what state an item is in
- what action they can take
- what will happen after the action

Do not make important actions discoverable only through icons, hover states, or ambiguous labels.

Use explicit action labels such as:

- `Report Lost Item`
- `Report Found Item`
- `View Match`
- `Submit Claim`
- `Approve Claim`
- `Reject Claim`
- `Record Return`

Avoid vague labels such as:

- `Proceed`
- `Continue` when the actual action is known
- `Manage`
- `Process`
- `Action`

---

## 1.2 Prevent mistakes before they happen

The interface should make invalid or dangerous actions difficult.

Examples:

- Disable submit while a request is being submitted.
- Validate required fields before submission.
- Prevent duplicate submissions.
- Require confirmation for irreversible or consequential actions.
- Do not allow a user to claim an item that is already returned/closed.
- Do not allow an admin to approve a claim that is no longer pending.

---

## 1.3 Preserve context

Users should not lose their place unnecessarily.

Prefer:

- inline feedback
- contextual dialogs
- drawers for short reviews
- dedicated pages for substantial tasks

Do not navigate away from a list merely to perform a small action.

---

## 1.4 Show system state explicitly

Statuses must be visible and understandable.

Core item statuses:

- `Pending`
- `Possible Match`
- `Claim Pending`
- `Returned`
- `Closed`

Claim statuses:

- `Pending`
- `Approved`
- `Rejected`

Do not communicate important state using color alone.

---

# 2. User Roles

There are two primary roles.

## 2.1 Student/User

Can:

- register/login/logout
- report lost items
- report found items
- browse items
- view their reports
- view possible matches
- receive notifications
- submit claims
- view their claims
- manage their profile

## 2.2 OSAS/Admin

Can:

- access the admin dashboard
- review lost reports
- review found reports
- review claims
- approve/reject claims
- record item returns
- manage item records

The backend requires authenticated sessions for data endpoints. The UX must therefore assume that protected pages/actions require authentication.

---

# 3. Navigation

## 3.1 Primary user navigation

The user navigation contains:

- Home
- Browse Items
- My Reports
- My Claims
- Notifications
- Profile

The primary navigation should remain available on desktop.

On mobile, it may become:

- a bottom navigation
- a compact navigation bar
- or a menu/drawer

Do not remove access to important destinations merely because the viewport is smaller.

---

## 3.2 Admin navigation

Admin navigation should expose:

- Dashboard
- Lost Items
- Found Items
- Claims
- Returns
- Notifications/account controls as appropriate

Admin functionality should be clearly separated from normal student functionality.

---

## 3.3 Navigation after actions

After a successful action, navigate to the place where the user can verify the result.

Examples:

| Action | Destination |
|---|---|
| Report lost item | Report confirmation / My Reports |
| Report found item | Report confirmation / My Reports |
| Submit claim | My Claims / claim details |
| View notification match | Match/item details |
| Approve claim | Claim details with updated status |
| Reject claim | Claim details with updated status |
| Record return | Return record / updated item details |

Do not send users back to the dashboard by default when a more contextual destination exists.

---

# 4. Pages vs Modals vs Drawers vs Popovers

## 4.1 Use a dedicated page when

Use a full page when the user needs to:

- complete a substantial form
- review substantial information
- compare item information and photos
- submit a claim
- review a claim in depth
- perform a multi-step process
- navigate directly to the content using a URL

Examples:

- Report Lost Item
- Report Found Item
- Item Details
- Claim Request
- Admin Claim Review

---

## 4.2 Use a modal/dialog when

Use a modal for a **short, focused decision or confirmation**.

Good uses:

- Confirm rejecting a claim
- Confirm approving a claim when an additional confirmation is useful
- Confirm a destructive action
- Confirm leaving a form with unsaved changes
- Short confirmation after an action when navigation is unnecessary

A modal should contain:

1. Clear title
2. Short explanation
3. Primary action
4. Secondary/cancel action

Example:

**Reject claim?**

> The claimant will be notified that the claim was rejected.

`Cancel` `Reject Claim`

---

## 4.3 Do not use a modal for

Avoid modals for:

- long forms
- large tables
- full claim verification
- detailed item comparison
- multi-step workflows
- content that users may need to reference while navigating

If the content needs scrolling for substantial reading, prefer a page.

---

## 4.4 Use a drawer when

A drawer can be used for quick contextual inspection without leaving the current list.

Good examples:

- Quick preview of an item
- Quick preview of notification details
- Short admin record preview

A drawer should not become a disguised full page.

If the drawer contains extensive content or multiple major actions, use a dedicated page instead.

---

## 4.5 Use a popover for

Popovers are for lightweight supporting information.

Examples:

- Filter controls
- Sort options
- Small contextual help
- Short status explanations

Do not place important workflows inside a popover.

---

# 5. Forms

## 5.1 Form structure

Forms should be grouped into logical sections.

### Lost Item

Fields:

- Item name
- Description
- Color
- Date lost
- Location lost
- Photo
- Additional details

### Found Item

Fields:

- Item name
- Description
- Color
- Date found
- Location found
- Photo
- Additional details

### Claim

Fields:

- Claimant name
- Student/personnel ID
- Contact information
- Additional item details
- Proof of ownership

---

## 5.2 Required fields

Clearly indicate required fields.

Do not require users to guess which fields are mandatory.

Optional fields should be explicitly labeled when appropriate.

---

## 5.3 Validation

Use validation at two levels:

### Field-level validation

Use for:

- missing required fields
- invalid formats
- invalid file types
- invalid file sizes

Show the error near the relevant field.

### Submission-level validation

Use when:

- multiple fields interact
- the server rejects the request
- the requested action is no longer valid

Do not replace specific field errors with a generic:

> Something went wrong.

when the actual problem is known.

---

## 5.4 Validation timing

Do not aggressively show errors while the user is still typing.

Preferred behavior:

- Validate obvious constraints on blur.
- Validate the complete form on submit.
- Keep valid input intact after an error.
- Move/focus attention to the first invalid field when practical.

---

## 5.5 Submit behavior

When submitting:

1. Validate the form.
2. Disable the submit action.
3. Show a loading state.
4. Send the request once.
5. Preserve entered data if the request fails.
6. Show success or error feedback.
7. Re-enable the action if the user can retry.

Never allow repeated clicks to create duplicate reports or claims.

---

# 6. Image Upload UX

Image matching is a central feature of the system.

The system uses CLIP to find visually similar items. The UI must therefore communicate that a match is a **possible match**, not proof that two objects are the same.

---

## 6.1 Upload interaction

The upload area should support:

- file selection
- drag and drop on desktop where appropriate
- image preview
- replacing the selected image
- removing the selected image
- clear validation feedback

---

## 6.2 Upload errors

If an image is invalid:

- keep the rest of the form intact
- identify the image problem
- explain what is acceptable
- allow the user to select another image

Do not reset the entire form because an image failed validation.

---

## 6.3 Matching language

Avoid language such as:

> We found your item.

Prefer:

> Possible match found

or:

> This item looks similar to a reported item.

The system finds visually similar items; a human must confirm ownership.

---

# 7. Match Results

When a possible match is detected, show:

- item photo
- item name
- Lost/Found type
- location
- relevant date
- similarity information where appropriate
- clear next action

The primary action is:

`View Match`

---

## 7.1 Similarity score

If a similarity score is exposed to users:

- label it clearly as a similarity score
- do not present it as a probability of ownership
- do not imply that a high score guarantees identity

Example:

> Visual similarity: 90%

Better supporting text:

> This score represents visual similarity between the uploaded photos. It does not confirm ownership.

---

## 7.2 Multiple matches

When multiple candidates exist:

- show them in a consistent list/grid
- allow comparison
- identify each candidate clearly
- do not force the user to inspect candidates one at a time unless necessary

The system may return multiple candidates because visual matching is not guaranteed to identify the exact item.

---

# 8. Notifications

Notifications should communicate:

- what happened
- which item/claim it concerns
- what action is available

Example:

> Possible match found for your lost backpack.

Action:

`View Match`

---

## 8.1 Notification behavior

Unread notifications should have a visually distinct state.

Opening a notification should:

1. Mark it as read.
2. Navigate to the relevant content when a destination exists.

Do not mark every notification as read merely because the notifications page was opened.

---

## 8.2 Notifications without a destination

If a notification is informational only:

- display the message
- mark it as read
- do not show a misleading action button

---

# 9. Item Details

Item details should provide enough information for a user to determine whether an item could be theirs.

Show:

- photo
- name
- description
- color
- date reported
- location
- status

If the current user is eligible to claim the item, show:

`Submit Claim`

If they are not eligible, do not show an actionable claim button.

---

# 10. Claim Flow

## 10.1 Before submission

The user should be able to review the item and their claim information before submitting.

---

## 10.2 Submit claim

After submission:

- prevent duplicate submissions
- show a loading state
- confirm successful submission
- show the claim status as `Pending`

Do not imply that the claim has been approved.

---

## 10.3 Pending claim

A pending claim should clearly communicate:

> Your claim is awaiting OSAS verification.

The user should not be presented with actions that contradict the pending state.

---

## 10.4 Approved claim

Show:

- Approved status
- relevant item information
- instructions or next steps for physical release/return when applicable

---

## 10.5 Rejected claim

Show:

- Rejected status
- decision note when available
- relevant next information

Do not present `Submit Claim` again if the underlying item is no longer claimable.

---

# 11. Admin Claim Verification

Admin verification is a consequential workflow and should not be compressed into a single ambiguous button.

The review should expose:

### Item information

- item photo
- item name
- description
- color
- date
- location
- item status

### Claimant information

- name
- student/personnel ID
- contact
- additional details
- proof of ownership

The admin then chooses:

- `Approve Claim`
- `Reject Claim`

---

## 11.1 Approve

Approval should clearly communicate the consequence.

Possible confirmation:

**Approve claim?**

> Approving this claim allows the item to be released to the claimant.

Actions:

`Cancel` `Approve Claim`

After approval:

- update the claim status
- notify the user
- expose the next return/release step
- prevent the same claim from being approved again

---

## 11.2 Reject

Rejecting a claim should require confirmation.

A rejection reason/decision note should be requested when the system supports it.

Example:

**Reject claim?**

> The claimant will be notified of the rejection.

Actions:

`Cancel` `Reject Claim`

After rejection:

- update the claim status
- notify the user
- remove actions that only apply to pending claims

---

# 12. Return Recording

Recording the physical return is a distinct step from approving a claim.

Do not automatically represent:

> Claim approved

as:

> Item returned

The UI should preserve this distinction.

After the physical item is released, the admin records:

- return date
- item information
- claimant
- relevant notes

After recording the return:

- save the return record
- set the item to `Returned` / `Closed` according to the system state
- show confirmation
- prevent duplicate return recording

---

# 13. Confirmation Rules

## 13.1 Require confirmation for

Use confirmation for consequential actions such as:

- Reject Claim
- Approve Claim when confirmation is needed before release
- destructive deletion if deletion exists
- abandoning a form with unsaved information

---

## 13.2 Do not require confirmation for

Avoid unnecessary confirmation for reversible or low-risk actions:

- opening an item
- opening a notification
- changing a filter
- changing a sort order
- opening/closing a drawer
- navigating to another page

Do not make the interface confirmation-heavy.

---

# 14. Toasts vs Inline Feedback vs Dialogs

## Use a toast for

Short-lived confirmation of a completed action.

Examples:

> Report submitted successfully.

> Notification marked as read.

Use toasts when the user does not need to make another decision.

---

## Use inline feedback for

Persistent information tied to a specific UI element.

Examples:

- form validation
- upload errors
- field errors
- contextual warnings

---

## Use a dialog for

Actions requiring an explicit decision.

Examples:

- Reject claim
- Confirm consequential approval
- Discard unsaved changes

---

# 15. Loading States

Every asynchronous operation should communicate that work is happening.

Examples:

- form submission → loading button
- item list → skeleton/loading state
- claim review → content loading state
- image upload → upload progress/loading state
- match retrieval → match-loading state

Do not leave users wondering whether a click worked.

---

## 15.1 Button loading

When a button is processing:

- disable it
- preserve its label where possible
- show a spinner/progress indicator

Example:

`Submit Claim` → `Submitting...`

Do not allow a second submission.

---

# 16. Empty States

Empty states should explain the situation and, when useful, provide the next action.

### My Reports

> You haven't reported any lost or found items yet.

Action:

`Report an Item`

### My Claims

> You don't have any claims yet.

### Notifications

> You're all caught up.

### Search/Browse

> No items match your current search.

If filters caused the empty state, offer:

`Clear Filters`

Do not use a blank screen.

---

# 17. Error States

Errors should be:

- specific
- actionable
- understandable

Prefer:

> We couldn't submit your report. Check your connection and try again.

over:

> Error 500.

If the backend provides a specific validation error, display the relevant message.

---

## 17.1 Network failure

Keep the user's entered information whenever possible.

Provide:

`Try Again`

Do not force the user to re-enter a long form.

---

## 17.2 Authorization errors

If a session expires:

- explain that the session has expired
- direct the user to log in again
- avoid silently losing their current context where possible

---

## 17.3 Not found

If an item no longer exists or cannot be accessed:

> This item is no longer available.

Provide a relevant navigation option such as:

`Back to Browse`

---

# 18. Status Behavior

Use consistent status labels throughout the application.

| Status | Meaning |
|---|---|
| Pending | Report/item is awaiting the next system or staff action |
| Possible Match | The matching system identified a visually similar item |
| Claim Pending | A claim has been submitted and awaits verification |
| Returned | The item has been physically released/returned |
| Closed | The item workflow is complete |

Statuses should not change merely because a page was viewed.

---

# 19. Search, Filter, and Sort

Search should update results without requiring unnecessary navigation.

Filters should:

- clearly indicate active filters
- be removable individually
- provide `Clear Filters` when multiple filters are active

Sort controls should describe the actual ordering.

Examples:

- Newest
- Oldest
- Most Relevant

Do not use unexplained sort labels.

---

# 20. Tables and Lists

Lists should support quick scanning.

Each item should expose enough information to distinguish it from other records.

For admin lists, prioritize:

- item
- type
- status
- date
- relevant user/claim information
- primary action

Avoid placing every possible field into the main table.

Secondary information can be shown on the details page.

---

# 21. Destructive and Consequential Actions

Consequential actions must make their outcome explicit.

Use action-specific labels.

Bad:

`Confirm`

Good:

`Reject Claim`

Bad:

`Continue`

Good:

`Approve Claim`

The primary button should describe what will actually happen.

---

# 22. Unsaved Changes

If a user has entered meaningful information into a form and attempts to leave:

Show a confirmation such as:

**Discard changes?**

> Your entered information will be lost.

Actions:

`Keep Editing`
`Discard Changes`

Do not show this confirmation when the form is untouched.

---

# 23. Responsive Behavior

The application must remain usable on desktop and mobile.

## Desktop

Use available horizontal space for:

- navigation
- comparison layouts
- tables
- image + information layouts

## Mobile

Prioritize:

1. primary content
2. primary action
3. status
4. supporting information

Tables may become:

- stacked cards
- horizontally scrollable tables
- responsive rows

Do not simply shrink desktop layouts until text becomes unreadable.

---

# 24. Accessibility

## Keyboard

All interactive controls must be keyboard accessible.

Focus must remain visible.

Dialogs should:

- move focus into the dialog
- trap focus while open
- return focus to the triggering element after closing when appropriate

---

## Labels

Inputs must have accessible labels.

Do not rely on placeholder text as the only label.

---

## Color

Never communicate status through color alone.

For example:

`Approved` should include text, not just a green indicator.

---

## Images

User-uploaded item images should have meaningful alternative text where the image conveys item information.

Decorative images should not create unnecessary screen-reader noise.

---

# 25. Interaction Consistency

The same action should behave the same way everywhere.

Examples:

- `View Match` always opens the match context.
- `Submit Claim` always starts the claim workflow.
- `Reject Claim` always requires the appropriate confirmation.
- Status labels retain the same meaning across user and admin screens.

Do not create different interaction patterns for identical operations on different pages.

---

# 26. Important Domain Rules

These rules are specific to the Lost & Found system.

### Rule 1 — Matching is not ownership verification

A visual match indicates similarity, not ownership.

### Rule 2 — Claim approval is not return completion

An approved claim means OSAS approved the claim.

A return record means the physical item was released.

### Rule 3 — Human verification remains part of the workflow

The system assists matching, but OSAS verifies claims.

### Rule 4 — Opposite item types are matched

A new found item is matched against lost items, and a lost item is matched against found items.

### Rule 5 — Closed/returned items should not behave like active items

Once an item is returned/closed, actions intended for active reports should no longer be available.

---

# 27. UX Anti-Patterns

Avoid:

- unnecessary modal dialogs
- nested modals
- vague button labels
- color-only status indicators
- full-page reloads for simple actions
- clearing forms after failed requests
- duplicate submissions
- unexplained loading
- empty screens with no explanation
- claiming that an AI/visual match proves ownership
- mixing claim approval with physical return
- hiding important actions inside three-dot menus
- making users navigate away for simple confirmations
- showing admin-only actions to normal users
- allowing actions that contradict the current item/claim status

---

# 28. Primary User Flow

## Lost Item

```text
Home
  ↓
Report Lost Item
  ↓
Fill Form
  ↓
Upload Photo
  ↓
Submit
  ↓
Confirmation
  ↓
My Reports
  ↓
Possible Match
  ↓
View Match
  ↓
Review Candidate
  ↓
Submit Claim
  ↓
Claim Pending
  ↓
OSAS Verification
  ↓
Approved / Rejected
  ↓
If Approved → Physical Release
  ↓
Return Recorded
  ↓
Returned / Closed
```

---

# 29. Found Item Flow

```text
Home
  ↓
Report Found Item
  ↓
Fill Form
  ↓
Upload Photo
  ↓
Submit
  ↓
Confirmation
  ↓
Finder is instructed to turn over
physical item to OSAS
  ↓
System checks for possible matches
  ↓
Potential owner is notified
```

---

# 30. Admin Flow

```text
Admin Dashboard
  ↓
Review Claims
  ↓
Open Claim
  ↓
Review Item
  ↓
Review Claimant
  ↓
Review Proof
  ↓
Approve / Reject
  ↓
Notify User
  ↓
If Approved
  ↓
Physical Release
  ↓
Record Return
  ↓
Returned / Closed
```

---

# 31. Design Tool Instruction

When generating or modifying UI with a design-oriented AI tool such as Impeccable:

1. Follow this document for **behavior**.
2. Follow the project's visual design system for **appearance**.
3. Follow the application's backend/data model for **available states and actions**.
4. Do not invent new workflows unless explicitly requested.
5. Do not invent actions that are not supported by the backend.
6. Do not change domain terminology without a reason.
7. If a visual design conflicts with an interaction rule here, preserve the interaction rule and change the visual presentation.

The goal is to make the interface visually distinctive while keeping the underlying interaction model predictable, accessible, and consistent.
