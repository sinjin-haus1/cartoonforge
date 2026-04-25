'use client';

import { useState } from 'react';
import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { gql } from '@apollo/client';
import {
  Container,
  Typography,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import AdPreview from '@/components/AdPreview';

const GET_AD = gql`
  query GetAd($id: ID!) {
    ad(id: $id) {
      _id
      productDescription
      style
      cartoonPrompt
      imageUrl
      status
    }
  }
`;

const CREATE_AD = gql`
  mutation CreateAd($input: CreateAdInput!) {
    createAd(input: $input) {
      _id
      productDescription
      style
      status
    }
  }
`;

const GENERATE_IMAGE = gql`
  mutation GenerateAdImage($id: ID!) {
    generateAdImage(id: $id) {
      imageUrl
      publicId
    }
  }
`;

const AD_STYLES = [
  { value: 'cartoon', label: '🎨 Cartoon', description: 'Fun, bright, playful' },
  { value: 'illustrated', label: '🖼️ Illustrated', description: 'Detailed, editorial' },
  { value: 'animated', label: '🎬 Animated', description: 'Dynamic, cinematic' },
];

export default function CreatePage() {
  const client = useApolloClient();
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState('cartoon');
  const [createdAd, setCreatedAd] = useState<any>(null);
  const [generatedImage, setGeneratedImage] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'creating' | 'generating' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const [createAd] = useMutation(CREATE_AD);
  const [generateImage] = useMutation(GENERATE_IMAGE);

  const handleCreateAndGenerate = async () => {
    if (!description.trim()) {
      setErrorMessage('Please describe your product or service');
      return;
    }

    setStatus('creating');
    setErrorMessage('');

    try {
      const result = await createAd({
        variables: {
          input: {
            userId: 'demo-user',
            productDescription: description,
            style,
          },
        },
      });

      const newAd = result.data.createAd;
      setCreatedAd(newAd);
      setStatus('generating');

      const imageResult = await generateImage({
        variables: { id: newAd._id },
      });

      setGeneratedImage(imageResult.data.generateAdImage);
      await client.query({ query: GET_AD, variables: { id: newAd._id }, fetchPolicy: 'network-only' });
      setStatus('done');
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to generate ad');
    }
  };

  const handleReset = () => {
    setCreatedAd(null);
    setGeneratedImage(null);
    setDescription('');
    setStyle('cartoon');
    setStatus('idle');
    setErrorMessage('');
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h3" sx={{ mb: 4 }}>
        Create Your Cartoon Ad
      </Typography>

      <Card sx={{ p: 4 }}>
        <Stack spacing={4}>
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              What are you selling?
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              placeholder="Example: Family-owned Italian restaurant serving handmade pasta and wood-fired pizza since 1985. Cozy atmosphere, fresh ingredients, great for date nights and family dinners."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={status === 'creating' || status === 'generating'}
            />
          </Box>

          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Choose your style
            </Typography>
            <FormControl fullWidth>
              <Select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                disabled={status === 'creating' || status === 'generating'}
                sx={{ mb: 2 }}
              >
                {AD_STYLES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    <Box>
                      <Typography>{s.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {s.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {errorMessage && (
            <Alert severity="error" onClose={() => setErrorMessage('')}>
              {errorMessage}
            </Alert>
          )}

          {status === 'idle' && (
            <Button
              variant="contained"
              size="large"
              onClick={handleCreateAndGenerate}
              fullWidth
              sx={{ py: 2 }}
            >
              ✨ Generate My Cartoon Ad
            </Button>
          )}

          {status === 'creating' && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography>Creating your ad...</Typography>
            </Box>
          )}

          {status === 'generating' && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography>AI is crafting your cartoon ad (this takes about 30 seconds)...</Typography>
            </Box>
          )}

          {status === 'done' && generatedImage && (
            <Stack spacing={3}>
              <AdPreview
                imageUrl={generatedImage.imageUrl}
                productDescription={description}
                style={style}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  variant="contained"
                  href="/videos"
                  fullWidth
                >
                  📱 Create Video Ad
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleReset}
                  fullWidth
                >
                  Create Another
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      </Card>

      <Card sx={{ mt: 4, p: 3, background: 'rgba(168, 85, 247, 0.1)' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          💡 Pro Tips
        </Typography>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            • Be specific about what makes your business unique
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Mention your target audience (families, professionals, etc.)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Include what you&apos;re known for or your specialty
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • The more detail, the better the AI prompt
          </Typography>
        </Stack>
      </Card>
    </Container>
  );
}
