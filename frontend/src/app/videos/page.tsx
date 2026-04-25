'use client';

import { useQuery, useMutation, gql } from '@apollo/client';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useState } from 'react';

// GraphQL Queries
const GET_VIDEOS = gql`
  query GetVideos($userId: String) {
    videos(userId: $userId) {
      _id
      adId
      videoUrl
      thumbnailUrl
      targetPlatform
      animationStyle
      durationSeconds
      aspectRatio
      status
      caption
      hashtags
      publishedAt
      externalPlatformUrl
      cloudinaryPublicId
      createdAt
      updatedAt
    }
    videoStats(userId: $userId) {
      total
      pending
      ready
      published
      failed
    }
  }
`;

const GET_ADS = gql`
  query GetAds {
    ads {
      _id
      productDescription
      imageUrl
      status
      createdAt
    }
  }
`;

// GraphQL Mutations
const GENERATE_VIDEO_CLIP = gql`
  mutation GenerateVideoClip($input: GenerateVideoClipInput!) {
    generateVideoClip(input: $input) {
      _id
      status
      videoUrl
      thumbnailUrl
      cloudinaryPublicId
    }
  }
`;

const PUBLISH_VIDEO = gql`
  mutation PublishVideo($id: ID!, $accessToken: String!) {
    publishVideo(id: $id, accessToken: $accessToken) {
      success
      publishedId
      platformUrl
      errorMessage
    }
  }
`;

const DELETE_VIDEO = gql`
  mutation DeleteVideo($id: ID!) {
    deleteVideo(id: $id)
  }
`;

const REFRESH_STATUS = gql`
  mutation RefreshVideoStatus($id: ID!) {
    refreshVideoStatus(id: $id) {
      _id
      status
      videoUrl
      externalPlatformUrl
    }
  }
`;

// Animation style options
const ANIMATION_STYLES = [
  { value: 'KEN_BURNS', label: 'Ken Burns (Zoom & Pan)', emoji: '🔍' },
  { value: 'ZOOM_PAN', label: 'Zoom & Pan', emoji: '📷' },
  { value: 'PULSE', label: 'Pulse Effect', emoji: '💓' },
  { value: 'SLIDE', label: 'Slide Transition', emoji: '➡️' },
  { value: 'FADE', label: 'Fade In/Out', emoji: '🌫️' },
];

// Platform options
const PLATFORMS = [
  { value: 'TIKTOK', label: 'TikTok', emoji: '📱' },
  { value: 'INSTAGRAM_REELS', label: 'Instagram Reels', emoji: '📸' },
  { value: 'YOUTUBE_SHORTS', label: 'YouTube Shorts', emoji: '▶️' },
  { value: 'SNAPCHAT', label: 'Snapchat', emoji: '👻' },
];

const platformEmojis: Record<string, string> = {
  tiktok: '📱',
  instagram_reels: '📸',
  youtube_shorts: '▶️',
  snapchat: '👻',
};

const statusColors: Record<string, { bg: string; color: string }> = {
  published: { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' },
  ready: { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
  failed: { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' },
  processing: { bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' },
  pending: { bg: 'rgba(107, 114, 128, 0.2)', color: '#6b7280' },
};

export default function VideosPage() {
  const userId = 'demo-user';
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [accessToken, setAccessToken] = useState('');
  
  // Form state for generating new video
  const [selectedAdId, setSelectedAdId] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('TIKTOK');
  const [selectedAnimation, setSelectedAnimation] = useState('KEN_BURNS');
  const [duration, setDuration] = useState(5);
  const [loopCount, setLoopCount] = useState(3);
  const [caption, setCaption] = useState('');

  const { loading, error, data, refetch } = useQuery(GET_VIDEOS, {
    variables: { userId },
  });

  const { data: adsData } = useQuery(GET_ADS);

  const [generateVideoClip, { loading: generating }] = useMutation(GENERATE_VIDEO_CLIP, {
    onCompleted: () => {
      setGenerateDialogOpen(false);
      refetch();
    },
    onError: (err) => {
      console.error('Failed to generate video:', err);
    },
  });

  const [publishVideo, { loading: publishing }] = useMutation(PUBLISH_VIDEO, {
    onCompleted: () => {
      setPublishDialogOpen(false);
      setSelectedVideo(null);
      refetch();
    },
    onError: (err) => {
      console.error('Failed to publish video:', err);
    },
  });

  const [deleteVideo] = useMutation(DELETE_VIDEO);
  const [refreshStatus] = useMutation(REFRESH_STATUS);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this video?')) {
      await deleteVideo({ variables: { id } });
      refetch();
    }
  };

  const handleRefresh = async (id: string) => {
    await refreshStatus({ variables: { id } });
    refetch();
  };

  const handleGenerate = () => {
    if (!selectedAdId) {
      alert('Please select an ad to generate video from');
      return;
    }
    generateVideoClip({
      variables: {
        input: {
          adId: selectedAdId,
          userId,
          targetPlatform: selectedPlatform,
          animationStyle: selectedAnimation,
          durationSeconds: duration,
          loopCount,
          caption,
        },
      },
    });
  };

  const handlePublish = () => {
    if (!selectedVideo || !accessToken) {
      alert('Please provide an access token');
      return;
    }
    publishVideo({
      variables: {
        id: selectedVideo._id,
        accessToken,
      },
    });
  };

  const openPublishDialog = (video: any) => {
    setSelectedVideo(video);
    setPublishDialogOpen(true);
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
        <Alert severity="error">Failed to load videos. Is the backend running?</Alert>
      </Container>
    );
  }

  const { videos } = data;
  const { ads } = adsData || { ads: [] };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h3" sx={{ mb: 1 }}>
            Video Ads
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generate animated video clips from your cartoon ads for social media
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          onClick={() => setGenerateDialogOpen(true)}
          startIcon={<span>🎬</span>}
        >
          Generate Video
        </Button>
      </Stack>

      {/* Stats Cards */}
      {data?.videoStats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, mb: 4 }}>
          {[
            { label: 'Total', value: data.videoStats.total, color: '#6b7280' },
            { label: 'Pending', value: data.videoStats.pending, color: '#f59e0b' },
            { label: 'Ready', value: data.videoStats.ready, color: '#3b82f6' },
            { label: 'Published', value: data.videoStats.published, color: '#10b981' },
            { label: 'Failed', value: data.videoStats.failed, color: '#ef4444' },
          ].map((stat) => (
            <Card key={stat.label} sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" sx={{ color: stat.color }}>
                {stat.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stat.label}
              </Typography>
            </Card>
          ))}
        </Box>
      )}

      {/* Video Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
        {videos.map((video: any) => {
          const platform = video.targetPlatform?.toLowerCase().replace('_', ' ') || 'unknown';
          const statusStyle = statusColors[video.status?.toLowerCase()] || statusColors.pending;

          return (
            <Card key={video._id}>
              <CardContent>
                {/* Header */}
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: '2rem' }}>
                    {platformEmojis[platform] || '🎬'}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                      {platform}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {video.animationStyle?.toLowerCase().replace('_', ' ') || 'ken burns'} •{' '}
                      {video.durationSeconds}s • {video.loopCount}x loop
                    </Typography>
                  </Box>
                  <Chip
                    label={video.status}
                    size="small"
                    sx={{ background: statusStyle.bg, color: statusStyle.color }}
                  />
                </Stack>

                {/* Video Preview */}
                {video.videoUrl && (
                  <Box
                    sx={{
                      mb: 2,
                      borderRadius: 2,
                      overflow: 'hidden',
                      background: '#000',
                    }}
                  >
                    <video
                      src={video.videoUrl}
                      controls
                      style={{ width: '100%', maxHeight: '200px' }}
                    />
                  </Box>
                )}

                {/* Caption & Hashtags */}
                {video.caption && (
                  <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
                    &quot;{video.caption}&quot;
                  </Typography>
                )}

                {/* Actions */}
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  {video.status === 'processing' && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleRefresh(video._id)}
                    >
                      🔄 Refresh
                    </Button>
                  )}
                  {video.status === 'ready' && (
                    <>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => openPublishDialog(video)}
                      >
                        📤 Publish
                      </Button>
                    </>
                  )}
                  {video.status === 'published' && video.externalPlatformUrl && (
                    <Button
                      size="small"
                      variant="outlined"
                      href={video.externalPlatformUrl}
                      target="_blank"
                    >
                      🔗 View Live
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => handleDelete(video._id)}
                  >
                    🗑️
                  </Button>
                </Stack>

                {/* Meta */}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  Created {new Date(video.createdAt).toLocaleDateString()}
                  {video.publishedAt && ` • Published ${new Date(video.publishedAt).toLocaleDateString()}`}
                </Typography>
              </CardContent>
            </Card>
          );
        })}

        {videos.length === 0 && (
          <Card sx={{ gridColumn: '1 / -1', p: 6, textAlign: 'center' }}>
            <Typography variant="h5" color="text.secondary" sx={{ mb: 2 }}>
              No videos yet
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Create an ad first, then generate an animated video clip for social media.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button href="/create" variant="outlined">
                Create an Ad
              </Button>
              <Button
                variant="contained"
                onClick={() => setGenerateDialogOpen(true)}
              >
                Generate Video
              </Button>
            </Stack>
          </Card>
        )}
      </Box>

      {/* Generate Video Dialog */}
      <Dialog open={generateDialogOpen} onClose={() => setGenerateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>🎬 Generate Video Clip</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {/* Select Ad */}
            <FormControl fullWidth>
              <InputLabel>Select Ad</InputLabel>
              <Select
                value={selectedAdId}
                label="Select Ad"
                onChange={(e) => setSelectedAdId(e.target.value)}
              >
                {ads
                  .filter((ad: any) => ad.status === 'READY' && ad.imageUrl)
                  .map((ad: any) => (
                    <MenuItem key={ad._id} value={ad._id}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Box
                          component="img"
                          src={ad.imageUrl}
                          sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1 }}
                        />
                        <Box>
                          <Typography variant="body2">{ad.productDescription}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {ad.status}
                          </Typography>
                        </Box>
                      </Stack>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            {/* Platform */}
            <FormControl fullWidth>
              <InputLabel>Target Platform</InputLabel>
              <Select
                value={selectedPlatform}
                label="Target Platform"
                onChange={(e) => setSelectedPlatform(e.target.value)}
              >
                {PLATFORMS.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    <Stack direction="row" spacing={1}>
                      <span>{p.emoji}</span>
                      <span>{p.label}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Animation Style */}
            <FormControl fullWidth>
              <InputLabel>Animation Style</InputLabel>
              <Select
                value={selectedAnimation}
                label="Animation Style"
                onChange={(e) => setSelectedAnimation(e.target.value)}
              >
                {ANIMATION_STYLES.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    <Stack direction="row" spacing={1}>
                      <span>{s.emoji}</span>
                      <span>{s.label}</span>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Duration & Loop */}
            <Stack direction="row" spacing={2}>
              <TextField
                label="Duration (seconds)"
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                inputProps={{ min: 3, max: 60 }}
                fullWidth
              />
              <TextField
                label="Loop Count"
                type="number"
                value={loopCount}
                onChange={(e) => setLoopCount(Number(e.target.value))}
                inputProps={{ min: 1, max: 10 }}
                fullWidth
              />
            </Stack>

            {/* Caption */}
            <TextField
              label="Caption (optional)"
              multiline
              rows={2}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption for your video..."
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleGenerate}
            disabled={generating || !selectedAdId}
            startIcon={generating ? <CircularProgress size={16} /> : <span>🎬</span>}
          >
            {generating ? 'Generating...' : 'Generate Video'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={publishDialogOpen} onClose={() => setPublishDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>📤 Publish to {selectedVideo?.targetPlatform}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {selectedVideo?.videoUrl && (
              <Box sx={{ borderRadius: 2, overflow: 'hidden', background: '#000' }}>
                <video
                  src={selectedVideo.videoUrl}
                  controls
                  style={{ width: '100%', maxHeight: '200px' }}
                />
              </Box>
            )}
            <Alert severity="info">
              You need an API access token from {selectedVideo?.targetPlatform} to publish.
              This token will be used to authenticate with the platform API.
            </Alert>
            <TextField
              label="Access Token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Paste your platform access token here"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublishDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handlePublish}
            disabled={publishing || !accessToken}
            startIcon={publishing ? <CircularProgress size={16} /> : <span>📤</span>}
          >
            {publishing ? 'Publishing...' : 'Publish Now'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}