import { TrafficLight } from './enums';

export interface CreateClientDto {
  name: string;
  cedula: string;
  phone: string;
  address: string;
  email?: string;
  notes?: string;
}

export interface UpdateClientDto {
  name?: string;
  phone?: string;
  address?: string;
  email?: string;
  notes?: string;
}

export interface ClientResponse {
  id: string;
  name: string;
  cedula: string;
  phone: string;
  address: string;
  email: string | null;
  notes: string | null;
  rating: number;
  isPunished: boolean;
  trafficLight: TrafficLight;
  createdAt: string;
  updatedAt: string;
}
