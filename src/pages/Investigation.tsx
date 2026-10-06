import { useParams } from 'react-router-dom';

export default function Investigation() {
  const { id } = useParams<{ id: string }>();
  return <h1>Investigation {id}</h1>;
}
