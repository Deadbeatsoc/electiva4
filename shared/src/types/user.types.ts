export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  cedula: string;
  roleId: string;
}

export interface UpdateUserDto {
  email?: string;
  name?: string;
  cedula?: string;
  roleId?: string;
  isActive?: boolean;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  cedula: string;
  isActive: boolean;
  mustChangePassword: boolean;
  role: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}
