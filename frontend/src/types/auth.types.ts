export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  cedula?: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  role: {
    id: string;
    name: string;
    permissions?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    accessToken: string;
    user: User;
  };
}
