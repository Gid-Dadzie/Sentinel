import { useParams } from 'react-router-dom';

export default function CustomerProfile() {
  const { accountId } = useParams<{ accountId: string }>();
  return <h1>Customer {accountId}</h1>;
}
