export interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  uniqueCode: string;
  status: 'confirmed' | 'pending' | 'checked-in';
  checkinTime?: string;
  createdAt: string;
}

export interface EventSettings {
  eventName: string;
  date: string;
  location: string;
  qrFormat: string;
  autoEmail: boolean;
  allowReentry: boolean;
  vipBadgeColor: string;
}

// Mock guest data
export const mockGuests: Guest[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@techcorp.com',
    phone: '+1 (555) 123-4567',
    organization: 'TechCorp International',
    uniqueCode: 'EVT-2026-001',
    status: 'checked-in',
    checkinTime: '2026-03-01T09:15:00',
    createdAt: '2026-02-15T10:30:00',
  },
  {
    id: '2',
    name: 'Michael Chen',
    email: 'mchen@innovate.com',
    phone: '+1 (555) 234-5678',
    organization: 'Innovate Solutions',
    uniqueCode: 'EVT-2026-002',
    status: 'checked-in',
    checkinTime: '2026-03-01T09:30:00',
    createdAt: '2026-02-16T14:20:00',
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    email: 'emily.r@globalventures.com',
    phone: '+1 (555) 345-6789',
    organization: 'Global Ventures LLC',
    uniqueCode: 'EVT-2026-003',
    status: 'confirmed',
    createdAt: '2026-02-17T11:45:00',
  },
  {
    id: '4',
    name: 'David Park',
    email: 'dpark@startuplab.io',
    phone: '+1 (555) 456-7890',
    organization: 'StartupLab',
    uniqueCode: 'EVT-2026-004',
    status: 'checked-in',
    checkinTime: '2026-03-01T10:00:00',
    createdAt: '2026-02-18T16:10:00',
  },
  {
    id: '5',
    name: 'Jessica Williams',
    email: 'jwilliams@enterprise.com',
    phone: '+1 (555) 567-8901',
    organization: 'Enterprise Corp',
    uniqueCode: 'EVT-2026-005',
    status: 'confirmed',
    createdAt: '2026-02-19T09:25:00',
  },
  {
    id: '6',
    name: 'Robert Thompson',
    email: 'rthompson@consulting.com',
    phone: '+1 (555) 678-9012',
    organization: 'Thompson Consulting',
    uniqueCode: 'EVT-2026-006',
    status: 'checked-in',
    checkinTime: '2026-03-01T09:45:00',
    createdAt: '2026-02-20T13:40:00',
  },
  {
    id: '7',
    name: 'Amanda Lee',
    email: 'alee@digitalagency.com',
    phone: '+1 (555) 789-0123',
    organization: 'Digital Agency Pro',
    uniqueCode: 'EVT-2026-007',
    status: 'pending',
    createdAt: '2026-02-21T10:15:00',
  },
  {
    id: '8',
    name: 'Christopher Davis',
    email: 'cdavis@financesolutions.com',
    phone: '+1 (555) 890-1234',
    organization: 'Finance Solutions Inc',
    uniqueCode: 'EVT-2026-008',
    status: 'checked-in',
    checkinTime: '2026-03-01T10:15:00',
    createdAt: '2026-02-22T15:30:00',
  },
  {
    id: '9',
    name: 'Jennifer Martinez',
    email: 'jmartinez@marketingpro.com',
    phone: '+1 (555) 901-2345',
    organization: 'Marketing Pro',
    uniqueCode: 'EVT-2026-009',
    status: 'confirmed',
    createdAt: '2026-02-23T11:20:00',
  },
  {
    id: '10',
    name: 'Daniel Brown',
    email: 'dbrown@techstartup.com',
    phone: '+1 (555) 012-3456',
    organization: 'Tech Startup Hub',
    uniqueCode: 'EVT-2026-010',
    status: 'checked-in',
    checkinTime: '2026-03-01T09:20:00',
    createdAt: '2026-02-24T14:50:00',
  },
];

// Mock event settings
export const mockSettings: EventSettings = {
  eventName: 'Annual Tech Summit 2026',
  date: '2026-03-15T09:00:00',
  location: 'Grand Convention Center, San Francisco',
  qrFormat: 'QR Code v2',
  autoEmail: true,
  allowReentry: false,
  vipBadgeColor: '#D6C6A5',
};

// Analytics mock data
export const mockAnalytics = {
  totalRegistered: 250,
  totalConfirmed: 220,
  totalCheckedIn: 145,
  checkinRate: 65.9,
  hourlyCheckins: [
    { hour: '08:00', count: 12 },
    { hour: '09:00', count: 45 },
    { hour: '10:00', count: 38 },
    { hour: '11:00', count: 25 },
    { hour: '12:00', count: 15 },
    { hour: '13:00', count: 10 },
  ],
  topOrganizations: [
    { name: 'TechCorp International', count: 15 },
    { name: 'Innovate Solutions', count: 12 },
    { name: 'Global Ventures LLC', count: 10 },
    { name: 'Enterprise Corp', count: 8 },
    { name: 'Digital Agency Pro', count: 7 },
  ],
  peakArrivalTime: '09:00 AM',
};

// Activity feed
export const mockActivities = [
  {
    id: '1',
    type: 'check-in',
    message: 'Christopher Davis checked in',
    time: '2 minutes ago',
  },
  {
    id: '2',
    type: 'registration',
    message: 'New registration: Jennifer Martinez',
    time: '15 minutes ago',
  },
  {
    id: '3',
    type: 'check-in',
    message: 'David Park checked in',
    time: '28 minutes ago',
  },
  {
    id: '4',
    type: 'check-in',
    message: 'Robert Thompson checked in',
    time: '35 minutes ago',
  },
  {
    id: '5',
    type: 'registration',
    message: 'New registration: Amanda Lee',
    time: '1 hour ago',
  },
];
