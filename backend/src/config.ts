import { PrismaClient } from "@prisma/client"
import type { JwtPayload } from "jsonwebtoken"
import zod from "zod"

export const PORT = process.env.PORT || 3001
export const JWT_SECRET = process.env.JWT_SECRET
export const client = new PrismaClient()
export interface UserPayload extends JwtPayload {
  userId: string;
  role: string;
}


//types definations 
export const regesterUser = zod.object({
  name: zod.string(),
  surname: zod.string(),
  grade: zod.string()
})
export const loginUser = zod.object({
  username: zod.string(),
  password: zod.string()
})


export const createNewsPostInput = zod.object({
  title: zod.string(),
  type: zod.string(),
  content: zod.string(),
})
export const createPostInput = zod.object({
  title: zod.string(),
  type: zod.string(),
  metaDescription: zod.string().optional(),
  description: zod.string(),
  coverImage: zod.string(),
  organizer: zod.string().optional()
})
export const createCommentInput = zod.object({
  comment: zod.string(),
})
export const updateNewsPostInput = zod.object({
  title: zod.string().optional(),
  type: zod.string().optional(),
  content: zod.string().optional(),
})
export const createAnnouncementInput = zod.object({
  content: zod.string()
})
export const updatePostInput = zod.object({
  title: zod.string().optional(),
  type: zod.string().optional(),
  metaDescription: zod.string().optional(),
  description: zod.string().optional(),
  coverImage: zod.string().optional(),
  organizer:zod.string().optional()
})
export const getPostByType = zod.object({
  type: zod.enum([
    "clubs",
    "cas",
    "events",
    "competitions"]).default("clubs")
})
export const userSelect = {
  id: true,
  username: true,
  name: true,
  surname: true,
  role: true,
  grade: true,
  firstLogin: true,
  createdAt: true,
  updatedAt: true,
};



