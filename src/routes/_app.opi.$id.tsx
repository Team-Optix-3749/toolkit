import {createFileRoute} from '@tanstack/react-router'
import {OpiDetail} from '~/components/OpiDetail'
export const Route=createFileRoute('/_app/opi/$id')({component:Detail})
function Detail(){const {id}=Route.useParams();return <OpiDetail id={id}/>}
