import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class XService {
    @PrimaryGeneratedColumn()
    id: number = 0

    @Column({ type: "varchar", length: 256, unique: true })
    username: string = ""

    @Column({ type: "bool", default: false })
    deleteTweets: boolean = false

    @Column({ type: "int", default: 30 })
    tweetsDaysThreshold: number = 30

    @Column({ type: "bool", default: false })
    tweetsEnableRetweetThreshold: boolean = false

    @Column({ type: "int", default: 20 })
    tweetsRetweetThreshold: number = 20

    @Column({ type: "bool", default: false })
    tweetsEnableLikeThreshold: boolean = false

    @Column({ type: "int", default: 20 })
    tweetsLikeThreshold: number = 20

    @Column({ type: "bool", default: false })
    deleteLikes: boolean = false

    @Column({ type: "int", default: 60 })
    likesDaysThreshold: number = 60

    @Column({ type: "bool", default: false })
    deleteDirectMessages: boolean = false

    @Column()
    directMessageDaysThreshold: number = 30
}
