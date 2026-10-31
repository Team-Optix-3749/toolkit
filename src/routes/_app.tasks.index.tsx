import {createFileRoute} from '@tanstack/react-router'
import {TaskWorkspace} from '~/components/TaskWorkspace'
export const Route=createFileRoute('/_app/tasks/')({component:TaskWorkspace})
