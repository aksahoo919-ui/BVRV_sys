// The admin menu: seven areas, each one a sidebar entry. An area with several pages shows them as tabs
// (see GroupTabs). Route paths are unchanged, so every link, bookmark and dashboard shortcut still works.
export const GROUPS = [
  { key: 'home', label: 'Home', icon: 'home', tabs: [
    { to: '/admin/home', label: 'Dashboard' },
  ] },
  { key: 'people', label: 'People', icon: 'users', tabs: [
    { to: '/admin/users', label: 'All Users' },
    { to: '/admin/pending', label: 'Approvals', badge: 'pending' },
    { to: '/admin/profile-requests', label: 'Profile Requests', badge: 'requests' },
    { to: '/admin/mentors/bvrv', label: 'BVRV Mentors' },
    { to: '/admin/mentors/bv', label: 'BV Leaders' },
    { to: '/admin/bv-members', label: 'BV Members' },
  ] },
  { key: 'classes', label: 'Classes', icon: 'temple', tabs: [
    { to: '/admin/classes', label: 'Class Management' },
    { to: '/admin/subjects', label: 'Subjects' },
    { to: '/admin/timetable', label: 'Timetable' },
    { to: '/admin/class-mentors', label: 'BV Leader Assignment' },
  ], hidden: [
    // Same "add a student to a class" job as Class Management; kept reachable by its address only.
    { to: '/admin/enrollments', label: 'Course Enrollments' },
  ] },
  { key: 'setup', label: 'Setup', icon: 'book', tabs: [
    { to: '/admin/courses', label: 'Courses' },
    { to: '/admin/academic-years', label: 'Academic Years' },
    { to: '/admin/semesters', label: 'Course Semesters' },
  ] },
  { key: 'attendance', label: 'Attendance', icon: 'trend', tabs: [
    { to: '/admin/attendance', label: 'Attendance Summary' },
    { to: '/admin/corrections', label: 'Attendance Corrections' },
  ] },
  { key: 'reports', label: 'Reports', icon: 'chart', tabs: [
    { to: '/admin/reports', label: 'Reports' },
    { to: '/admin/results', label: 'Results' },
  ] },
  { key: 'system', label: 'System', icon: 'cog', tabs: [
    { to: '/admin/settings', label: 'Settings' },
    { to: '/admin/audit', label: 'Audit Logs' },
    { to: '/admin/backups', label: 'Backups' },
  ] },
];

// Flat page list for the top breadcrumb.
export const PAGES = GROUPS.flatMap(g => [...g.tabs, ...(g.hidden || [])].map(t => ({ ...t, group: g.label })));

export const groupOf = pathname =>
  GROUPS.find(g => [...g.tabs, ...(g.hidden || [])].some(t => pathname === t.to || pathname.startsWith(t.to + '/')));
