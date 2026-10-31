import {createFileRoute} from '@tanstack/react-router'
import {OpiDetail} from '~/components/OpiDetail'
export const Route=createFileRoute('/_app/admin/opi/$id/review')({component:Review})
function Review(){const {id}=Route.useParams();return <OpiDetail id={id}/>}
