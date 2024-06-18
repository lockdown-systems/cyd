import { PrismaClient } from '@prisma/client'

export async function getConfig(prisma: PrismaClient, key: string): Promise<string | null> {
    const config = await prisma.config.findUnique({
        where: {
            key: key
        }
    })
    if (config) {
        return config.value
    }
    return null
}

export async function setConfig(prisma: PrismaClient, key: string, value: string) {
    return prisma.config.upsert({
        where: {
            key: key
        },
        update: {
            value: value
        },
        create: {
            key: key,
            value: value
        }
    })
}
