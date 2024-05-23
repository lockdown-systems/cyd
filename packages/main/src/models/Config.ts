import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class Config {
    @PrimaryGeneratedColumn()
    id: number | undefined;

    @Column({ type: "varchar", length: 256, unique: true })
    key: string | undefined;

    @Column({ type: "text" })
    value: string | undefined;
}