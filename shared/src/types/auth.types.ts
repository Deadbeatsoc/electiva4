export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    cedula: string;
    role: {
      id: string;
      name: string;
      permissions: string[];
    };
  };
}

export interface TokenPayload {
  userId: string;
  email: string;
  roleId: string;
  roleName: string;
}
