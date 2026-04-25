'use client';

import { useQuery, useMutation, gql } from '@apollo/client';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Chip,
  Button,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useState } from 'react';

const GET_ADS = gql`
  query GetAds($userId: String) {
    ads(userId: $userId) {
      _id
      productDescription
      style
      cartoonPrompt
      imageUrl
      status
      createdAt
    }
    adStats(userId: $userId) {
      total
      pending
      ready
      failed
    }
  }
`;

const DELETE_AD = gql`
  mutation DeleteAd($id: ID!) {
    deleteAd(id: $id)
  }
`;

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card sx={{ textAlign: 'center', p: 2 }}>
      <Typography variant="h3" sx={{ color, fontWeight: 700 }}>
        {value}
      </Typography>
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
    </Card>
  );
}

export default function DashboardPage() {
  const userId = 'demo-user';
  const { loading, error, data, refetch } = useQuery(GET_ADS, {
    variables: { userId },
  });
  const [deleteAd] = useMutation(DELETE_AD);

  const handleDelete = async (id: string) => {
    await deleteAd({ variables: { id } });
    refetch();
  };

  if (loading) {
    return (
      <Container sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ py: 4 }}>
        <Alert severity="error">Failed to load ads. Is the backend running?</Alert>
      </Container>
    );
  }

  const { ads, adStats } = data;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" sx={{ mb: 4 }}>
        Your Ads Dashboard
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} md={3}>
          <StatCard label="Total Ads" value={adStats.total} color="#a855f7" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Generating" value={adStats.pending} color="#f59e0b" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Ready" value={adStats.ready} color="#10b981" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Failed" value={adStats.failed} color="#ef4444" />
        </Grid>
      </Grid>

      {ads.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h5" color="text.secondary" sx={{ mb: 2 }}>
            No ads yet
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Create your first cartoon ad and watch your business grow.
          </Typography>
          <Button href="/create" variant="contained">
            Create Your First Ad
          </Button>
        </Card>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 3,
          }}
        >
          {ads.map((ad: any) => (
            <Card key={ad._id}>
              {ad.imageUrl && (
                <CardMedia
                  component="img"
                  height="200"
                  image={ad.imageUrl}
                  alt={ad.productDescription}
                  sx={{ objectFit: 'cover' }}
                />
              )}
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Chip
                    label={ad.style}
                    size="small"
                    sx={{
                      background: 'rgba(168, 85, 247, 0.2)',
                      color: '#c084fc',
                    }}
                  />
                  <Chip
                    label={ad.status}
                    size="small"
                    sx={{
                      background:
                        ad.status === 'ready'
                          ? 'rgba(16, 185, 129, 0.2)'
                          : ad.status === 'failed'
                          ? 'rgba(239, 68, 68, 0.2)'
                          : 'rgba(245, 158, 11, 0.2)',
                      color:
                        ad.status === 'ready'
                          ? '#10b981'
                          : ad.status === 'failed'
                          ? '#ef4444'
                          : '#f59e0b',
                    }}
                  />
                </Stack>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  {ad.productDescription}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(ad.createdAt).toLocaleDateString()}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button size="small" variant="outlined" href={`/create?edit=${ad._id}`}>
                    Edit
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => handleDelete(ad._id)}
                  >
                    Delete
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Container>
  );
}
