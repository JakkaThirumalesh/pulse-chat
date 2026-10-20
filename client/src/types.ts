export interface Profile {
  id: string;
  username: string;
}

export interface Room {
  id: string;
  name: string;
  created_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

export interface OnlineUser {
  id: string;
  username: string;
}
